"""
PriceCharting.com scraper for PTCG card prices.

URL patterns:
  English:  /game/pokemon-{set-slug}/{card-slug}
  Japanese: /game/pokemon-japanese-{set-slug}/{card-slug}-{number}
  Search:   /search-products?q={query}&type=prices

Price tiers scraped: ungraded, grade-7 through grade-9.5, PSA 10, BGS 10.
"""

import asyncio
import re
import unicodedata
from typing import Any

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://www.pricecharting.com"

# <td id="..."> → our price tier key
# Confirmed from live HTML: table#price_data thead order is
# Ungraded | Grade 7 | Grade 8 | Grade 9 | Grade 9.5 | PSA 10
_ID_PRICE_MAP = {
    "used_price":     "ungraded",
    "complete_price": "grade_7",
    "new_price":      "grade_8",
    "graded_price":   "grade_9",
    "box_only_price": "grade_9_5",
    "manual_only_price": "psa_10",
    "sell_price":     "bgs_10",
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

_PRICE_RE = re.compile(r"[\$,¥]?([\d,]+\.?\d*)")


def slugify(text: str) -> str:
    """Convert card/set name to PriceCharting URL slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[''']", "", text)              # drop apostrophes
    text = re.sub(r"\s*&\s*", "-&-", text)         # "scarlet & violet" → "scarlet-&-violet"
    text = re.sub(r"[^a-z0-9&]+", "-", text)       # non-alnum (except &) → hyphen
    text = re.sub(r"-{2,}", "-", text)              # collapse double hyphens
    text = text.strip("-")
    return text


def build_url(card_name: str, set_name: str, language: str = "en", card_number: str = "") -> str:
    """Build a direct PriceCharting product URL."""
    card_slug = slugify(card_name)
    set_slug = slugify(set_name)
    # PriceCharting appends the card number to the slug for both languages
    suffix = f"-{card_number}" if card_number else ""

    if language == "ja":
        game = f"pokemon-japanese-{set_slug}"
    else:
        game = f"pokemon-{set_slug}"

    return f"{BASE_URL}/game/{game}/{card_slug}{suffix}"


def _parse_price(text: str) -> float | None:
    if not text:
        return None
    text = text.strip().replace(",", "")
    m = _PRICE_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _extract_prices(soup: BeautifulSoup) -> dict[str, float | None]:
    prices: dict[str, float | None] = {
        "ungraded": None,
        "grade_7": None,
        "grade_8": None,
        "grade_9": None,
        "grade_9_5": None,
        "psa_10": None,
        "bgs_10": None,
    }

    # Scope to #price_data table to avoid picking up prices from the set listing
    scope = soup.find("table", id="price_data") or soup

    for td_id, tier in _ID_PRICE_MAP.items():
        td = scope.find("td", id=td_id)
        if not td:
            continue
        # First js-price span is the price; second (if any) is the delta — skip it
        span = td.find("span", class_="js-price")
        if span:
            prices[tier] = _parse_price(span.get_text())

    return prices


def _extract_product_id(soup: BeautifulSoup) -> str | None:
    el = soup.find(attrs={"data-product-id": True})
    if el:
        return str(el["data-product-id"])
    return None


def _extract_title(soup: BeautifulSoup) -> str:
    h1 = soup.find("h1", id="product_name")
    if h1:
        return h1.get_text(strip=True)
    title = soup.find("title")
    if title:
        return title.get_text(strip=True).split("|")[0].strip()
    return ""


def _extract_card_image(soup: BeautifulSoup) -> str | None:
    """Extract the card image URL from a PriceCharting product page."""
    # PriceCharting stores card images on storage.googleapis.com
    # Find any img whose src contains this domain
    for img in soup.find_all("img", src=True):
        src = str(img["src"])
        if "storage.googleapis.com" in src and "pricecharting" in src:
            return src

    # Try og:image meta tag (often contains the card image)
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        content = str(og["content"])
        if "storage.googleapis.com" in content or "pricecharting" in content:
            return content

    # Generic fallback: first img with a full https URL that looks like a card
    for selector in ["#product_image img", ".product-image img", "#photo img"]:
        img = soup.select_one(selector)
        if img and img.get("src"):
            src = str(img["src"])
            if src.startswith("//"):
                src = "https:" + src
            if src.startswith("http"):
                return src

    return None


async def fetch_prices_by_url(url: str, client: httpx.AsyncClient) -> dict[str, Any]:
    """Fetch and parse prices from a known PriceCharting product URL."""
    for attempt in range(2):
        resp = await client.get(url, headers=_HEADERS, follow_redirects=True)
        if resp.status_code == 403 and attempt == 0:
            await asyncio.sleep(1.5)
            continue
        resp.raise_for_status()
        break

    soup = BeautifulSoup(resp.text, "html.parser")
    prices = _extract_prices(soup)
    return {
        "url": str(resp.url),
        "product_id": _extract_product_id(soup),
        "title": _extract_title(soup),
        "prices": prices,
        "currency": "USD",
        "card_image_url": _extract_card_image(soup),
    }


async def search(query: str, client: httpx.AsyncClient, limit: int = 5) -> list[dict[str, Any]]:
    """Search PriceCharting and return matching product stubs."""
    params = {"q": query, "type": "prices"}
    for attempt in range(2):
        resp = await client.get(
            f"{BASE_URL}/search-products",
            params=params,
            headers=_HEADERS,
            follow_redirects=True,
        )
        if resp.status_code == 403 and attempt == 0:
            await asyncio.sleep(2.0)
            continue
        if resp.status_code == 403:
            return []  # give up gracefully
        resp.raise_for_status()
        break

    final_url = str(resp.url)
    soup = BeautifulSoup(resp.text, "html.parser")

    # Single-result redirect: PriceCharting sends us straight to the product page
    if "search-products" not in final_url and "/game/" in final_url:
        h1 = soup.find("h1") or soup.find("title")
        return [{
            "name": h1.get_text(strip=True).split("|")[0].strip() if h1 else query,
            "url": final_url,
            "product_id": None,
        }]

    results = []
    for row in soup.select("table#games_table tbody tr")[:limit]:
        a = row.find("a", href=True)
        if not a:
            continue
        href = a["href"]
        if "/game/pokemon" not in href:
            continue
        name_td = row.find("td", class_="title")
        results.append({
            "name": name_td.get_text(strip=True) if name_td else a.get_text(strip=True),
            "url": BASE_URL + href if href.startswith("/") else href,
            "product_id": row.get("id", "").replace("product-", "") or None,
        })

    return results


async def get_card_prices(
    card_name: str,
    set_name: str,
    language: str = "en",
    card_number: str = "",
) -> dict[str, Any] | None:
    """
    Main entry point. Tries the direct URL first; falls back to search.
    Returns a dict with keys: url, product_id, title, prices, currency.
    prices keys: ungraded, grade_7, grade_8, grade_9, grade_9_5, psa_10, bgs_10.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        direct_url = build_url(card_name, set_name, language, card_number)
        try:
            result = await fetch_prices_by_url(direct_url, client)
            # If we got a page but all prices are None, the URL resolved to a
            # generic/wrong page — fall through to search.
            if any(v is not None for v in result["prices"].values()):
                return result
        except (httpx.HTTPStatusError, httpx.RequestError):
            pass

        # Fallback: search — try multiple query variants for better coverage
        queries = [f"{card_name} {set_name}"]
        # For Japanese cards, also try without "Full Art" / "FA" prefix
        if language == "ja":
            core = re.sub(r"^(?:full\s+art|fa)\s+", "", card_name, flags=re.IGNORECASE).strip()
            if core != card_name:
                queries.append(f"{core} {set_name}")
        if card_number:
            queries = [q + f" {card_number}" for q in queries]

        hits: list[dict[str, Any]] = []
        for q in queries:
            hits = await search(q, client, limit=8)
            if hits:
                break
        if not hits:
            return None

        # Language filtering — strict first, then fallback
        if language == "ja":
            lang_hits = [h for h in hits if "pokemon-japanese-" in h["url"]]
        else:
            lang_hits = [
                h for h in hits
                if "/game/pokemon-" in h["url"] and "pokemon-japanese-" not in h["url"]
                and "pokemon-chinese-" not in h["url"]
                and "pokemon-korean-" not in h["url"]
            ]
        pool = lang_hits if lang_hits else hits

        card_slug = slugify(card_name)
        # For FA cards, also try matching core name without "full-art" prefix
        core_slug = re.sub(r"^full-art-", "", card_slug)

        # Prefer hit whose URL contains both card slug and card number
        best = None
        if card_number:
            best = next(
                (h for h in pool if card_slug in h["url"] and card_number in h["url"]),
                None,
            )
            if not best:
                best = next(
                    (h for h in pool if core_slug in h["url"] and card_number in h["url"]),
                    None,
                )
        if not best:
            best = next(
                (h for h in pool if card_slug in slugify(h["name"]) or core_slug in slugify(h["name"])),
                pool[0],
            )

        try:
            return await fetch_prices_by_url(best["url"], client)
        except (httpx.HTTPStatusError, httpx.RequestError):
            return None


async def get_card_prices_batch(
    cards: list[dict[str, Any]],
    concurrency: int = 3,
) -> list[dict[str, Any] | None]:
    """
    Fetch prices for multiple cards concurrently.
    Each card dict: {card_name, set_name, language?, card_number?}
    """
    sem = asyncio.Semaphore(concurrency)

    async def _fetch(card: dict[str, Any]) -> dict[str, Any] | None:
        async with sem:
            return await get_card_prices(
                card_name=card["card_name"],
                set_name=card["set_name"],
                language=card.get("language", "en"),
                card_number=card.get("card_number", ""),
            )

    return await asyncio.gather(*(_fetch(c) for c in cards))
