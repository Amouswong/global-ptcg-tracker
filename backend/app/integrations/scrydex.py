from typing import Any

import httpx

from app.config import settings

BASE_URL = "https://api.scrydex.com/pokemon/v1"

GRADING_COMPANIES = ("PSA", "CGC", "BGS")
GRADE_VALUES = (10, 9.5, 9, 8.5, 8, 7, 6, 5)


def _headers() -> dict[str, str]:
    return {
        "X-Api-Key": settings.scrydex_api_key,
        "X-Team-ID": settings.scrydex_team_id,
    }


def _is_configured() -> bool:
    return bool(settings.scrydex_api_key and settings.scrydex_team_id)


def _parse_raw_prices(prices: list[dict]) -> list[dict[str, Any]]:
    results = []
    for p in prices:
        if p.get("type") != "raw":
            continue
        results.append({
            "condition": p.get("condition", "NM"),
            "currency": p.get("currency", "USD"),
            "low": p.get("low"),
            "market": p.get("market"),
            "trends": p.get("trends", {}),
        })
    return results


def _parse_graded_prices(prices: list[dict]) -> list[dict[str, Any]]:
    results = []
    for p in prices:
        if p.get("type") != "graded":
            continue
        results.append({
            "company": p.get("company"),
            "grade": p.get("grade"),
            "currency": p.get("currency", "USD"),
            "low": p.get("low"),
            "mid": p.get("mid"),
            "high": p.get("high"),
            "market": p.get("market"),
            "is_perfect": p.get("is_perfect", False),
            "trends": p.get("trends", {}),
        })
    return results


async def get_card_prices(scrydex_id: str, lang: str = "en") -> dict[str, Any] | None:
    if not _is_configured():
        return None
    url = f"{BASE_URL}/{lang}/cards/{scrydex_id}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params={"include": "prices"}, headers=_headers())
        if resp.status_code in (401, 403, 404):
            return None
        resp.raise_for_status()
        data = resp.json()

    prices = data.get("prices", [])
    return {
        "raw": _parse_raw_prices(prices),
        "graded": _parse_graded_prices(prices),
    }


async def search_card_id(card_name: str, set_code: str, number: str, lang: str = "en") -> str | None:
    """Find the Scrydex card ID by name + set + number."""
    if not _is_configured():
        return None
    params = {"q": card_name, "page_size": 5}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{BASE_URL}/{lang}/cards", params=params, headers=_headers())
        if not resp.is_success:
            return None
        results = resp.json().get("data", [])

    for card in results:
        if (
            card.get("number") == number
            and card.get("expansion", {}).get("code", "").lower() == set_code.lower()
        ):
            return card.get("id")
    return None
