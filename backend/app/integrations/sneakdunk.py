"""
Sneakdunk (snkrdunk.com) price scraper using Playwright.

Intercepts the XHR/fetch requests the page makes to find the internal API
endpoints, then extracts lowest ask price and market price in JPY.
"""

import asyncio
import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# JPY to HKD approximate rate (snkrdunk prices are in JPY)
_JPY_TO_HKD = 0.052

_SEARCH_URL = "https://snkrdunk.com/en/trading-cards"


def _jpy_to_hkd(jpy: float | None) -> float | None:
    if jpy is None:
        return None
    return round(jpy * _JPY_TO_HKD, 1)


async def search_card_price(
    name_en: str,
    name_ja: str | None = None,
    number: str | None = None,
    set_code: str | None = None,
) -> dict[str, Any] | None:
    """
    Search snkrdunk.com for a card and return price data.

    Returns dict with keys:
        url, lowest_ask_jpy, lowest_ask_hkd, market_price_jpy, market_price_hkd,
        product_id, title
    or None if not found.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("playwright not installed — skipping Sneakdunk scrape")
        return None

    # Build search query: prefer Japanese name for JP cards, fall back to English
    query = name_ja or name_en
    if number:
        # Strip set prefix if present (e.g. "130/090" → keep as-is)
        query = f"{query} {number}"

    captured: list[dict] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            ),
            locale="en-US",
        )
        page = await context.new_page()

        # Intercept all API responses
        async def handle_response(response):
            url = response.url
            if any(kw in url for kw in ["/api/", "trading_card", "products", "search"]):
                try:
                    body = await response.json()
                    captured.append({"url": url, "body": body})
                except Exception:
                    pass

        page.on("response", handle_response)

        try:
            search_url = f"{_SEARCH_URL}?keyword={query.replace(' ', '+')}"
            await page.goto(search_url, wait_until="networkidle", timeout=30000)
            # Give extra time for lazy-loaded content
            await asyncio.sleep(2)
        except Exception as e:
            logger.warning("Sneakdunk page load failed: %s", e)
            await browser.close()
            return None

        # Also try to get page HTML for __NEXT_DATA__
        html = await page.content()
        await browser.close()

    # Try to parse __NEXT_DATA__ from HTML
    result = _parse_next_data(html, query)
    if result:
        return result

    # Try captured API responses
    result = _parse_api_responses(captured, query)
    if result:
        return result

    logger.info("Sneakdunk: no price found for %r", query)
    return None


def _parse_next_data(html: str, query: str) -> dict[str, Any] | None:
    """Extract price from __NEXT_DATA__ JSON embedded in the page."""
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None

    # Walk the data tree looking for card listings with prices
    cards = _find_cards_in_tree(data)
    if not cards:
        return None

    best = _pick_best_match(cards, query)
    if not best:
        return None

    return _normalise_card(best)


def _parse_api_responses(captured: list[dict], query: str) -> dict[str, Any] | None:
    """Parse intercepted XHR/fetch responses for card price data."""
    for item in captured:
        body = item["body"]
        cards = _find_cards_in_tree(body)
        if cards:
            best = _pick_best_match(cards, query)
            if best:
                return _normalise_card(best)
    return None


def _find_cards_in_tree(obj: Any, depth: int = 0) -> list[dict]:
    """Recursively search a JSON tree for objects that look like card listings."""
    if depth > 10:
        return []
    results = []
    if isinstance(obj, dict):
        # Looks like a card if it has a name/title and some price field
        has_name = any(k in obj for k in ["name", "title", "product_name", "card_name"])
        has_price = any(k in obj for k in [
            "lowest_ask", "market_price", "price", "min_price",
            "lowestAsk", "marketPrice", "minPrice", "sell_price",
        ])
        if has_name and has_price:
            results.append(obj)
        for v in obj.values():
            results.extend(_find_cards_in_tree(v, depth + 1))
    elif isinstance(obj, list):
        for item in obj:
            results.extend(_find_cards_in_tree(item, depth + 1))
    return results


def _pick_best_match(cards: list[dict], query: str) -> dict | None:
    """Pick the card that best matches the search query."""
    if not cards:
        return None
    query_lower = query.lower()
    # Score each card by how many query words appear in its name
    query_words = set(query_lower.split())

    def score(card: dict) -> int:
        name = str(
            card.get("name") or card.get("title") or
            card.get("product_name") or card.get("card_name") or ""
        ).lower()
        return sum(1 for w in query_words if w in name)

    scored = sorted(cards, key=score, reverse=True)
    best = scored[0]
    # Only return if at least one word matched
    if score(best) == 0:
        return None
    return best


def _normalise_card(card: dict) -> dict[str, Any]:
    """Extract and normalise price fields from a card dict."""
    def get_price(*keys) -> float | None:
        for k in keys:
            v = card.get(k)
            if v is not None:
                try:
                    return float(v)
                except (TypeError, ValueError):
                    pass
        return None

    lowest_ask_jpy = get_price("lowest_ask", "lowestAsk", "min_price", "minPrice", "sell_price", "price")
    market_price_jpy = get_price("market_price", "marketPrice", "avg_price", "avgPrice")

    name = (
        card.get("name") or card.get("title") or
        card.get("product_name") or card.get("card_name") or ""
    )
    product_id = str(card.get("id") or card.get("product_id") or card.get("productId") or "")
    url = card.get("url") or card.get("product_url") or ""
    if product_id and not url:
        url = f"https://snkrdunk.com/en/trading-cards/{product_id}"

    return {
        "url": url or None,
        "product_id": product_id or None,
        "title": name,
        "lowest_ask_jpy": lowest_ask_jpy,
        "lowest_ask_hkd": _jpy_to_hkd(lowest_ask_jpy),
        "market_price_jpy": market_price_jpy,
        "market_price_hkd": _jpy_to_hkd(market_price_jpy),
    }
