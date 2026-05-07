import hashlib
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import scrydex
from app.models.db.card import Card
from app.models.db.price_history import PriceHistory
from app.models.schemas.price import (
    GradedPriceSchema,
    HistoryDataPointSchema,
    PlatformPriceSchema,
    PriceHistoryResponseSchema,
    PriceResponseSchema,
)
from app.services.mock_price_service import get_all_mock_prices
from app.utils.cache import cache_get, cache_set
from app.utils.iqr import PlatformRawPrice, compute_composite_price

RANGE_DAYS = {"7d": 7, "30d": 30, "3m": 90}

# Graded price multipliers relative to NM (used when Scrydex key not configured)
GRADE_MULTIPLIERS: dict[str, dict[float, float]] = {
    "PSA": {10: 4.5, 9.5: 2.8, 9: 1.8, 8.5: 1.3, 8: 1.1, 7: 0.9, 6: 0.7, 5: 0.5},
    "CGC": {10: 4.0, 9.5: 2.5, 9: 1.6, 8.5: 1.2, 8: 1.0, 7: 0.8, 6: 0.65, 5: 0.45},
    "BGS": {10: 5.0, 9.5: 3.2, 9: 2.0, 8.5: 1.4, 8: 1.1, 7: 0.9, 6: 0.7, 5: 0.5},
}


def _parse_condition(condition: str) -> tuple[str, str | None, float | None]:
    """Returns (raw_condition, grading_company, grade) e.g. 'PSA-10' → ('NM', 'PSA', 10.0)"""
    if "-" in condition:
        parts = condition.split("-", 1)
        company = parts[0].upper()
        if company in GRADE_MULTIPLIERS:
            try:
                return "NM", company, float(parts[1])
            except ValueError:
                pass
    return condition, None, None


async def get_prices(card_id: str, condition: str, db: AsyncSession) -> PriceResponseSchema | None:
    cache_key = f"card:{card_id}:prices:{condition}"
    cached = await cache_get(cache_key)
    if cached:
        result = PriceResponseSchema(**cached)
        result.cached = True
        return result

    stmt = select(Card).where(Card.id == card_id)
    res = await db.execute(stmt)
    card = res.scalar_one_or_none()
    if not card:
        return None

    raw_condition, grading_company, grade = _parse_condition(condition)

    # Try Scrydex for real prices
    scrydex_data = None
    is_japanese = card.id.startswith("tcgdex-")
    if scrydex.is_configured() if hasattr(scrydex, "is_configured") else scrydex._is_configured():
        lang = "ja" if is_japanese else "en"
        scrydex_id = card.raw_data.get("scrydex_id") if card.raw_data else None
        if not scrydex_id:
            scrydex_id = await scrydex.search_card_id(
                card.name, card.set_id, card.number or "", lang
            )
        if scrydex_id:
            scrydex_data = await scrydex.get_card_prices(scrydex_id, lang)

    # Build platform prices
    if scrydex_data and scrydex_data.get("raw"):
        platforms, composite_price, currency = _platforms_from_scrydex(
            scrydex_data["raw"], raw_condition, is_japanese
        )
    else:
        currency = "JPY" if is_japanese else "USD"
        raw_platform_data = get_all_mock_prices(card_id, raw_condition, card.rarity)
        if is_japanese:
            raw_platform_data = _convert_to_jpy(raw_platform_data)
        raw_prices = [PlatformRawPrice(p["platform"], p["price"], p["weight"]) for p in raw_platform_data]
        composite_price, processed = compute_composite_price(raw_prices)
        processed_map = {p.platform: p for p in processed}
        platforms = [
            PlatformPriceSchema(
                platform=d["platform"],
                price=d["price"],
                currency=currency,
                url=d["url"],
                weight=processed_map[d["platform"]].weight,
                is_outlier=processed_map[d["platform"]].is_outlier,
                last_updated=d["last_updated"],
            )
            for d in raw_platform_data
        ]

    # Build graded prices
    graded: list[GradedPriceSchema] = []
    if scrydex_data and scrydex_data.get("graded"):
        for g in scrydex_data["graded"]:
            graded.append(GradedPriceSchema(
                company=g["company"],
                grade=float(g["grade"]),
                currency=g["currency"],
                low=g.get("low"),
                mid=g.get("mid"),
                high=g.get("high"),
                market=g.get("market"),
                is_perfect=g.get("is_perfect", False),
                trend_7d=g.get("trends", {}).get("7d"),
                trend_30d=g.get("trends", {}).get("30d"),
            ))
    else:
        graded = _mock_graded_prices(composite_price, currency)

    # If a specific graded condition was requested, filter composite to that grade
    if grading_company and grade is not None:
        match = next((g for g in graded if g.company == grading_company and g.grade == grade), None)
        if match and match.market:
            composite_price = match.market

    now = datetime.now(timezone.utc)
    expires_at = now.replace(second=0, microsecond=0) + timedelta(hours=4)
    response = PriceResponseSchema(
        card_id=card_id,
        condition=condition,
        currency=currency,
        composite_price=composite_price,
        composite_method="iqr_weighted_avg",
        platforms=platforms,
        graded=graded,
        has_japanese_price=is_japanese,
        cached=False,
        cache_expires_at=expires_at,
    )

    for p in platforms:
        db.add(PriceHistory(
            card_id=card_id,
            condition=raw_condition,
            platform=p.platform,
            price=Decimal(str(p.price)),
            currency=currency,
            is_outlier=p.is_outlier,
            recorded_at=now,
        ))
    await db.commit()

    await cache_set(cache_key, response.model_dump(), ttl_seconds=14400)
    return response


def _platforms_from_scrydex(
    raw_prices: list[dict], condition: str, is_japanese: bool
) -> tuple[list[PlatformPriceSchema], float, str]:
    now = datetime.now(timezone.utc)
    cond_map = {"NM": "NM", "LP": "LP", "MP": "MP"}
    target = cond_map.get(condition, "NM")
    currency = "JPY" if is_japanese else "USD"

    matched = [p for p in raw_prices if p.get("condition") == target and p.get("currency") == currency]
    if not matched:
        matched = [p for p in raw_prices if p.get("condition") == target]
    if not matched:
        matched = raw_prices[:1]

    platforms = []
    for p in matched:
        price = p.get("market") or p.get("low") or 0.0
        platforms.append(PlatformPriceSchema(
            platform="Scrydex",
            price=price,
            currency=p.get("currency", currency),
            url=None,
            weight=1.0,
            is_outlier=False,
            last_updated=now,
        ))

    composite = matched[0].get("market") or matched[0].get("low") or 0.0 if matched else 0.0
    return platforms, composite, currency


def _convert_to_jpy(platform_data: list[dict]) -> list[dict]:
    JPY_RATE = 150
    result = []
    for p in platform_data:
        d = dict(p)
        d["price"] = round(d["price"] * JPY_RATE)
        d["currency"] = "JPY"
        result.append(d)
    return result


def _mock_graded_prices(nm_price: float, currency: str) -> list[GradedPriceSchema]:
    graded = []
    for company, grades in GRADE_MULTIPLIERS.items():
        for grade, mult in grades.items():
            market = round(nm_price * mult, 2)
            graded.append(GradedPriceSchema(
                company=company,
                grade=grade,
                currency=currency,
                low=round(market * 0.9, 2),
                mid=round(market * 0.95, 2),
                high=round(market * 1.1, 2),
                market=market,
                is_perfect=False,
                trend_7d=None,
                trend_30d=None,
            ))
    return graded


async def get_price_history(
    card_id: str, condition: str, range_str: str, db: AsyncSession
) -> PriceHistoryResponseSchema | None:
    stmt = select(Card).where(Card.id == card_id)
    res = await db.execute(stmt)
    card = res.scalar_one_or_none()
    if not card:
        return None

    raw_condition, _, _ = _parse_condition(condition)
    days = RANGE_DAYS.get(range_str, 30)
    is_japanese = card.id.startswith("tcgdex-")
    currency = "JPY" if is_japanese else "USD"

    await _ensure_history_seeded(card_id, raw_condition, card.rarity, days, is_japanese, db)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            func.date(PriceHistory.recorded_at).label("day"),
            PriceHistory.platform,
            func.avg(PriceHistory.price).label("avg_price"),
        )
        .where(
            PriceHistory.card_id == card_id,
            PriceHistory.condition == raw_condition,
            PriceHistory.recorded_at >= cutoff,
            PriceHistory.is_outlier == False,
        )
        .group_by(func.date(PriceHistory.recorded_at), PriceHistory.platform)
        .order_by(func.date(PriceHistory.recorded_at))
    )
    rows = (await db.execute(stmt)).all()

    day_data: dict[date, dict[str, float]] = {}
    for row in rows:
        d = row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
        if d not in day_data:
            day_data[d] = {}
        day_data[d][row.platform] = float(row.avg_price)

    data_points = []
    for d in sorted(day_data):
        pp = day_data[d]
        raw = [PlatformRawPrice(k, v, 0.33) for k, v in pp.items() if v > 0]
        composite, _ = compute_composite_price(raw) if raw else (0.0, [])
        data_points.append(HistoryDataPointSchema(
            date=d,
            composite_price=composite,
            tcgplayer_price=pp.get("TCGPlayer"),
            cardmarket_price=pp.get("Cardmarket"),
            ebay_price=pp.get("eBay"),
        ))

    return PriceHistoryResponseSchema(
        card_id=card_id, condition=condition, range=range_str, data_points=data_points
    )


async def _ensure_history_seeded(
    card_id: str, condition: str, rarity: str | None, days: int, is_japanese: bool, db: AsyncSession
) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    min_expected = int(days * 0.8) * 3
    stmt = select(func.count(PriceHistory.id)).where(
        PriceHistory.card_id == card_id,
        PriceHistory.condition == condition,
        PriceHistory.recorded_at >= cutoff,
    )
    count = (await db.execute(stmt)).scalar_one()
    if count >= min_expected:
        return

    from app.services.mock_price_service import CONDITION_MULTIPLIERS, PLATFORM_CONFIGS, _base_price_for_rarity

    base_price = _base_price_for_rarity(rarity)
    if is_japanese:
        base_price *= 150
    seed = hashlib.md5(f"{card_id}:{condition}:history".encode()).hexdigest()
    rng = random.Random(seed)
    current_price = base_price * CONDITION_MULTIPLIERS.get(condition, 1.0)
    currency = "JPY" if is_japanese else "USD"

    for day_offset in range(days, 0, -1):
        ts = datetime.now(timezone.utc) - timedelta(days=day_offset)
        drift = rng.uniform(-0.03, 0.03)
        current_price = max(0.01, current_price * (1 + drift))
        for cfg in PLATFORM_CONFIGS:
            variance = rng.uniform(0.92, 1.08)
            db.add(PriceHistory(
                card_id=card_id,
                condition=condition,
                platform=cfg["platform"],
                price=Decimal(str(round(current_price * variance, 2))),
                currency=currency,
                is_outlier=False,
                recorded_at=ts,
            ))
    await db.commit()
