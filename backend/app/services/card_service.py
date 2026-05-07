import asyncio
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import pokemontcg
from app.integrations import tcgdex
from app.models.db.card import Card
from app.models.schemas.card import CardDetailSchema, CardSearchResponseSchema, CardSummarySchema
from app.utils.cache import cache_get, cache_set


async def search_cards(q: str, page: int, page_size: int, db: AsyncSession) -> CardSearchResponseSchema:
    q = q.strip()
    cache_key = f"search:{q.lower()}:{page}:{page_size}"
    cached = await cache_get(cache_key)
    if cached:
        return CardSearchResponseSchema(**cached)

    cards, total = await _fetch_cards(q, page, page_size)

    for card_data in cards:
        await _upsert_card(card_data, db)
    await db.commit()

    result = CardSearchResponseSchema(
        results=[CardSummarySchema(**_to_summary(c)) for c in cards],
        total=total,
        page=page,
        page_size=page_size,
    )
    await cache_set(cache_key, result.model_dump(), ttl_seconds=3600)
    return result


async def _fetch_cards(q: str, page: int, page_size: int) -> tuple[list[dict], int]:
    if tcgdex.looks_like_japanese(q):
        # Japanese name — search TCGdex in Japanese, also try English pokemontcg.io in parallel
        ja_task = tcgdex.search_by_name(q, lang="ja", page=page, page_size=page_size)
        en_task = pokemontcg.search_cards(q, page, page_size)
        ja_data, en_data = await asyncio.gather(ja_task, en_task, return_exceptions=True)

        cards: list[dict] = []
        if not isinstance(ja_data, Exception):
            cards.extend(ja_data["cards"])
        if not isinstance(en_data, Exception):
            cards.extend(en_data["cards"])

        # deduplicate by name+number
        seen: set[str] = set()
        unique = []
        for c in cards:
            key = f"{c['name']}:{c.get('number', '')}:{c.get('set_id', '')}"
            if key not in seen:
                seen.add(key)
                unique.append(c)
        return unique, len(unique)

    elif tcgdex.looks_like_number(q):
        # Series number — search TCGdex by localId and pokemontcg.io by number in parallel
        num_task = tcgdex.search_by_number(q, page=page, page_size=page_size)
        # pokemontcg.io supports number: query syntax
        en_task = pokemontcg.search_cards_by_number(q, page, page_size)
        num_data, en_data = await asyncio.gather(num_task, en_task, return_exceptions=True)

        cards = []
        if not isinstance(en_data, Exception):
            cards.extend(en_data["cards"])
        if not isinstance(num_data, Exception):
            cards.extend(num_data["cards"])

        seen = set()
        unique = []
        for c in cards:
            key = f"{c['name']}:{c.get('number', '')}:{c.get('set_id', '')}"
            if key not in seen:
                seen.add(key)
                unique.append(c)
        return unique, len(unique)

    else:
        # Default English name search via pokemontcg.io
        data = await pokemontcg.search_cards(q, page, page_size)
        return data["cards"], data["total"]


async def get_card(card_id: str, db: AsyncSession) -> CardDetailSchema | None:
    cache_key = f"card:{card_id}:detail"
    cached = await cache_get(cache_key)
    if cached:
        return CardDetailSchema(**cached)

    stmt = select(Card).where(Card.id == card_id)
    result = await db.execute(stmt)
    db_card = result.scalar_one_or_none()

    if db_card and _is_cache_fresh(db_card):
        schema = CardDetailSchema.model_validate(db_card)
        await cache_set(cache_key, schema.model_dump(), ttl_seconds=86400)
        return schema

    # tcgdex-prefixed IDs come from TCGdex
    if card_id.startswith("tcgdex-"):
        raw_id = card_id[len("tcgdex-"):]
        raw = await tcgdex.get_card(raw_id)
    else:
        raw = await pokemontcg.get_card(card_id)

    if not raw:
        return None

    await _upsert_card(raw, db)
    await db.commit()

    stmt = select(Card).where(Card.id == card_id)
    result = await db.execute(stmt)
    db_card = result.scalar_one_or_none()
    if not db_card:
        return None

    schema = CardDetailSchema.model_validate(db_card)
    await cache_set(cache_key, schema.model_dump(), ttl_seconds=86400)
    return schema


async def _upsert_card(data: dict[str, Any], db: AsyncSession) -> None:
    stmt = select(Card).where(Card.id == data["id"])
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    cleaned = _clean_card_data(data)

    if existing:
        for key, value in cleaned.items():
            if hasattr(existing, key) and key not in ("id",):
                setattr(existing, key, value)
        existing.cached_at = datetime.now(timezone.utc)
    else:
        card = Card(**{k: v for k, v in cleaned.items() if hasattr(Card, k)})
        card.cached_at = datetime.now(timezone.utc)
        db.add(card)


def _clean_card_data(data: dict[str, Any]) -> dict[str, Any]:
    from datetime import date
    result = dict(data)
    rd = result.get("release_date")
    if isinstance(rd, str) and rd:
        try:
            result["release_date"] = date.fromisoformat(rd)
        except ValueError:
            result["release_date"] = None
    elif not isinstance(rd, date):
        result["release_date"] = None
    return result


def _is_cache_fresh(card: Card) -> bool:
    if not card.cached_at:
        return False
    cached_at = card.cached_at.replace(tzinfo=None) if card.cached_at.tzinfo else card.cached_at
    age_hours = (datetime.utcnow() - cached_at).total_seconds() / 3600
    return age_hours < card.cache_ttl_hours


def _to_summary(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": data["id"],
        "name": data["name"],
        "set_name": data.get("set_name", ""),
        "number": data.get("number"),
        "rarity": data.get("rarity"),
        "image_url_small": data.get("image_url_small"),
    }
