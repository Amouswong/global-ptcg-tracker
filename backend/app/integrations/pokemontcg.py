from typing import Any

import httpx

from app.config import settings

BASE_URL = "https://api.pokemontcg.io/v2"


def _headers() -> dict[str, str]:
    if settings.pokemontcg_api_key:
        return {"X-Api-Key": settings.pokemontcg_api_key}
    return {}


def _parse_card(raw: dict[str, Any]) -> dict[str, Any]:
    images = raw.get("images", {})
    set_data = raw.get("set", {})
    return {
        "id": raw["id"],
        "name": raw["name"],
        "set_id": set_data.get("id", ""),
        "set_name": set_data.get("name", ""),
        "series": set_data.get("series"),
        "number": raw.get("number"),
        "rarity": raw.get("rarity"),
        "supertype": raw.get("supertype"),
        "subtypes": raw.get("subtypes"),
        "hp": raw.get("hp"),
        "image_url_small": images.get("small"),
        "image_url_large": images.get("large"),
        "artist": raw.get("artist"),
        "release_date": set_data.get("releaseDate"),
        "raw_data": raw,
    }


async def search_cards(q: str, page: int = 1, page_size: int = 20) -> dict[str, Any]:
    params = {"q": f'name:"{q}*"', "page": page, "pageSize": page_size, "orderBy": "name"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{BASE_URL}/cards", params=params, headers=_headers())
        resp.raise_for_status()
        data = resp.json()
    cards = [_parse_card(c) for c in data.get("data", [])]
    return {"cards": cards, "total": data.get("totalCount", len(cards))}


async def search_cards_by_number(number: str, page: int = 1, page_size: int = 20) -> dict[str, Any]:
    params = {"q": f'number:"{number}"', "page": page, "pageSize": page_size, "orderBy": "name"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{BASE_URL}/cards", params=params, headers=_headers())
        resp.raise_for_status()
        data = resp.json()
    cards = [_parse_card(c) for c in data.get("data", [])]
    return {"cards": cards, "total": data.get("totalCount", len(cards))}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{BASE_URL}/cards/{card_id}", headers=_headers())
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
    return _parse_card(data["data"])
