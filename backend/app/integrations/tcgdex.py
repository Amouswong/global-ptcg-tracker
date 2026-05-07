import re
from typing import Any

import httpx

BASE_URL = "https://api.tcgdex.net/v2"

_NUMBER_RE = re.compile(r"^[A-Za-z]{0,4}\d+[-/]?\d*$")
_JAPANESE_RE = re.compile(r"[぀-ゟ゠-ヿ一-鿿]")


def looks_like_number(q: str) -> bool:
    return bool(_NUMBER_RE.match(q.strip()))


def looks_like_japanese(q: str) -> bool:
    return bool(_JAPANESE_RE.search(q))


def _parse_card(raw: dict[str, Any], lang: str = "en") -> dict[str, Any]:
    set_data = raw.get("set", {})
    image_base = raw.get("image")
    card_id = raw.get("id", "")
    # For list results, set info may be absent — derive set_id from card ID (e.g. "E1-016" → "E1")
    set_id = set_data.get("id") or (card_id.rsplit("-", 1)[0] if "-" in card_id else "")
    set_name = set_data.get("name") or set_id
    return {
        "id": f"tcgdex-{card_id}",
        "name": raw.get("name", ""),
        "set_id": set_id,
        "set_name": set_name,
        "series": None,
        "number": raw.get("localId"),
        "rarity": raw.get("rarity"),
        "supertype": raw.get("category"),
        "subtypes": None,
        "hp": str(raw["hp"]) if raw.get("hp") else None,
        "image_url_small": f"{image_base}/low.webp" if image_base else None,
        "image_url_large": f"{image_base}/high.webp" if image_base else None,
        "artist": raw.get("illustrator"),
        "release_date": None,
        "raw_data": raw,
        "_source": "tcgdex",
        "_lang": lang,
    }


async def get_card(card_id: str, lang: str = "en") -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{BASE_URL}/{lang}/cards/{card_id}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        raw = resp.json()
    parsed = _parse_card(raw, lang)
    parsed["id"] = f"tcgdex-{card_id}"
    return parsed


async def search_by_name(name: str, lang: str = "ja", page: int = 1, page_size: int = 20) -> dict[str, Any]:
    params = {
        "name": name,
        "pagination:page": page,
        "pagination:itemsPerPage": page_size,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{BASE_URL}/{lang}/cards", params=params)
        if resp.status_code == 404:
            return {"cards": [], "total": 0}
        resp.raise_for_status()
        data = resp.json()

    if not isinstance(data, list):
        return {"cards": [], "total": 0}

    cards = [_parse_card(c, lang) for c in data]
    return {"cards": cards, "total": len(cards)}


async def search_by_number(number: str, page: int = 1, page_size: int = 20) -> dict[str, Any]:
    params = {
        "localId": f"eq:{number.upper()}",
        "pagination:page": page,
        "pagination:itemsPerPage": page_size,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{BASE_URL}/en/cards", params=params)
        if resp.status_code == 404:
            return {"cards": [], "total": 0}
        resp.raise_for_status()
        data = resp.json()

    if not isinstance(data, list):
        return {"cards": [], "total": 0}

    cards = [_parse_card(c, "en") for c in data]
    return {"cards": cards, "total": len(cards)}
