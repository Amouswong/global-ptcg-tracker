"""
Sneakdunk (snkrdunk.com) price fetcher.

Uses simple HTTP requests to scrape the search page — no browser needed.
Search results appear as <a aria-label="NAME - ¥PRICE"> on /search?keyword=...&category=trading_card
"""

import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_JPY_TO_HKD = 0.052
_SEARCH_URL = "https://snkrdunk.com/search"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en;q=0.9",
}


def _jpy_to_hkd(jpy: float | None) -> float | None:
    if jpy is None:
        return None
    return round(jpy * _JPY_TO_HKD, 1)


def _parse_jpy(price_str: str) -> float | None:
    """Parse '¥4,298' or '4298' into a float."""
    cleaned = re.sub(r"[¥,\s]", "", price_str)
    try:
        return float(cleaned)
    except ValueError:
        return None


async def search_card_price(
    name_en: str,
    name_ja: str | None = None,
    number: str | None = None,
    set_code: str | None = None,
) -> dict[str, Any] | None:
    """
    Search snkrdunk.com for a card and return price data.

    Returns dict with keys:
        url, lowest_ask_jpy, lowest_ask_hkd, market_price_jpy, market_price_hkd, title
    or None if not found.
    """
    query = name_ja or name_en
    if number:
        query = f"{query} {number}"

    try:
        async with httpx.AsyncClient(timeout=15.0, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(
                _SEARCH_URL,
                params={"keyword": query, "category": "trading_card"},
            )
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        logger.warning("Sneakdunk fetch failed for %r: %s", query, e)
        return None

    # Each result: <a href="https://snkrdunk.com/apparels/ID" aria-label="NAME - ¥PRICE">
    pattern = re.compile(
        r'href="(https://snkrdunk\.com/apparels/(\d+))"[^>]*aria-label="([^"]+)"'
    )
    matches = pattern.findall(html)
    if not matches:
        logger.info("Sneakdunk: no results for %r", query)
        return None

    best = _pick_best(matches, query, name_en, name_ja, number)
    if not best:
        return None

    url, apparel_id, label = best
    # label format: "CARD NAME - ¥PRICE"
    parts = label.rsplit(" - ", 1)
    title = parts[0].strip()
    lowest_ask_jpy = _parse_jpy(parts[1]) if len(parts) == 2 else None

    return {
        "url": url,
        "product_id": apparel_id,
        "title": title,
        "lowest_ask_jpy": lowest_ask_jpy,
        "lowest_ask_hkd": _jpy_to_hkd(lowest_ask_jpy),
        "market_price_jpy": None,
        "market_price_hkd": None,
    }


def _pick_best(
    matches: list[tuple[str, str, str]],
    query: str,
    name_en: str,
    name_ja: str | None,
    number: str | None,
) -> tuple[str, str, str] | None:
    """Score each result and return the best match."""
    query_words = set(query.lower().split())
    en_words = set(name_en.lower().split())

    def score(match: tuple) -> int:
        _, _, label = match
        label_lower = label.lower()
        s = sum(1 for w in query_words if w in label_lower)
        s += sum(1 for w in en_words if w in label_lower)
        if name_ja and name_ja in label:
            s += 5
        if number and number in label:
            s += 3
        return s

    scored = sorted(matches, key=score, reverse=True)
    best = scored[0]
    if score(best) == 0:
        return None
    return best
