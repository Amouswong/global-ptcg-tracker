"""
Scan service: vision identification → PriceCharting price lookup → HKD conversion.
"""

import asyncio
import base64
import io
import uuid
from typing import Any

import httpx
from PIL import Image

from app.database import AsyncSessionLocal
from app.integrations import gemini_vision, pricecharting
from app.models.schemas.scan import ScannedCard, ScannedCardPrices, ScanResponseSchema

_FALLBACK_HKD_RATE = 7.83
_MAX_CARDS_PER_CALL = 8


def _split_image_rows(image_bytes: bytes, mime_type: str, n_rows: int) -> list[tuple[bytes, str]]:
    img = Image.open(io.BytesIO(image_bytes))
    w, h = img.size
    row_h = h // n_rows
    strips = []
    for i in range(n_rows):
        top = i * row_h
        bottom = h if i == n_rows - 1 else (i + 1) * row_h
        strip = img.crop((0, top, w, bottom))
        buf = io.BytesIO()
        fmt = "JPEG" if "jpeg" in mime_type else "PNG"
        strip.save(buf, format=fmt, quality=90)
        strips.append((buf.getvalue(), mime_type))
    return strips


async def _fetch_hkd_rate() -> float:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
            resp.raise_for_status()
            return float(resp.json()["rates"]["HKD"])
    except Exception:
        return _FALLBACK_HKD_RATE


def _to_hkd(value: float | None, rate: float) -> float | None:
    if value is None:
        return None
    return round(value * rate, 1)


def _grade_matched_price(prices: dict[str, Any], grade_company: str | None, grade_value: str | None) -> float | None:
    """Return the price tier that matches the card's actual grade."""
    if not grade_value:
        return None
    try:
        gv = float(grade_value)
    except ValueError:
        return None

    company = (grade_company or "").upper()

    if company == "BGS" and gv == 10:
        return prices.get("bgs_10")
    if gv == 10:
        return prices.get("psa_10")
    if gv == 9.5:
        return prices.get("grade_9_5")
    if gv == 9:
        return prices.get("grade_9")
    if gv == 8:
        return prices.get("grade_8")
    if gv == 7:
        return prices.get("grade_7")
    return None


def _build_prices(
    result: dict[str, Any] | None,
    grade_company: str | None,
    grade_value: str | None,
    hkd_rate: float,
) -> tuple[ScannedCardPrices | None, str | None]:
    if result is None:
        return None, "Price lookup failed or card not found on PriceCharting"
    p = result["prices"]

    graded_usd = _grade_matched_price(p, grade_company, grade_value)

    return ScannedCardPrices(
        ungraded=p.get("ungraded"),
        grade_7=p.get("grade_7"),
        grade_8=p.get("grade_8"),
        grade_9=p.get("grade_9"),
        grade_9_5=p.get("grade_9_5"),
        psa_10=p.get("psa_10"),
        bgs_10=p.get("bgs_10"),
        currency="USD",
        ungraded_hkd=_to_hkd(p.get("ungraded"), hkd_rate),
        grade_9_hkd=_to_hkd(p.get("grade_9"), hkd_rate),
        grade_9_5_hkd=_to_hkd(p.get("grade_9_5"), hkd_rate),
        psa_10_hkd=_to_hkd(p.get("psa_10"), hkd_rate),
        bgs_10_hkd=_to_hkd(p.get("bgs_10"), hkd_rate),
        hkd_rate=hkd_rate,
        source_url=result.get("url"),
        graded_price_usd=graded_usd,
        graded_price_hkd=_to_hkd(graded_usd, hkd_rate),
        card_image_url=result.get("card_image_url"),
    ), None


async def _fetch_price(card: dict[str, Any], hkd_rate: float) -> tuple[ScannedCardPrices | None, str | None]:
    set_name = card.get("set_name") or ""
    card_name = card.get("name_en") or card.get("name") or ""
    language = card.get("language", "en")
    number = card.get("number") or ""

    if "/" in number:
        number = number.split("/")[0]

    if not card_name or not set_name:
        return None, "Insufficient card info for price lookup"

    # Strip community shorthand prefixes that PriceCharting doesn't recognise
    # e.g. "FA Venusaur EX" → "Venusaur EX", "SR Charizard" → "Charizard"
    _STRIP_PREFIXES = ("FA ", "SR ", "SAR ", "AR ", "RR ", "HR ", "UR ", "CHR ", "CSR ", "ACE ")
    for prefix in _STRIP_PREFIXES:
        if card_name.upper().startswith(prefix.upper()):
            card_name = card_name[len(prefix):]
            break

    result = await pricecharting.get_card_prices(
        card_name=card_name,
        set_name=set_name,
        language=language,
        card_number=number,
    )
    return _build_prices(result, card.get("grade_company"), card.get("grade_value"), hkd_rate)


async def _download_image_as_b64(url: str) -> str | None:
    """Download an image from a URL and return it as base64 JPEG."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content))
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=85)
            return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def _crop_card_image(image_bytes: bytes, mime_type: str, bbox: list[float] | None) -> str | None:
    """Crop a card from the image using bbox [x_min, y_min, x_max, y_max] and return base64 JPEG."""
    if not bbox or len(bbox) != 4:
        return None
    try:
        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size
        x_min, y_min, x_max, y_max = bbox
        # Add a small padding (5% of card size)
        pad_x = (x_max - x_min) * 0.05
        pad_y = (y_max - y_min) * 0.05
        x_min = max(0, x_min - pad_x)
        y_min = max(0, y_min - pad_y)
        x_max = min(w, x_max + pad_x)
        y_max = min(h, y_max + pad_y)
        cropped = img.crop((int(x_min), int(y_min), int(x_max), int(y_max)))
        buf = io.BytesIO()
        cropped.convert("RGB").save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def _dedup(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str]] = set()
    out = []
    for card in cards:
        name_key = card.get("name_en", "").lower().strip()
        num_key = (card.get("number") or "").split("/")[0].strip()
        key = (name_key, num_key)
        if key not in seen:
            seen.add(key)
            out.append(card)
    return out


async def _detect_all_cards(image_bytes: bytes, mime_type: str) -> list[dict[str, Any]]:
    # Try full image first
    cards, truncated = await gemini_vision.identify_cards_with_truncation(image_bytes, mime_type)

    if not truncated:
        return cards

    # Output was cut off — split into 2 rows and retry each strip
    strips = _split_image_rows(image_bytes, mime_type, 2)
    results = await asyncio.gather(
        *[gemini_vision.identify_cards(data, mt, multi=True) for data, mt in strips]
    )
    merged = []
    for batch in results:
        merged.extend(batch)
    return _dedup(merged)


async def _save_scan_history(scan_id: str, cards: list[ScannedCard]) -> None:
    """Save scanned cards to scan_history table."""
    try:
        from app.models.db.scan_history import ScanHistory

        records = []
        for card in cards:
            p = card.prices
            record = ScanHistory(
                id=str(uuid.uuid4()),
                scan_id=scan_id,
                name_en=card.name_en,
                name=card.name,
                set_name=card.set_name,
                set_code=card.set_code,
                number=card.number,
                language=card.language,
                rarity=card.rarity,
                graded=card.graded,
                grade_company=card.grade_company,
                grade_value=card.grade_value,
                confidence=card.confidence,
                ungraded_usd=p.ungraded if p else None,
                psa_10_usd=p.psa_10 if p else None,
                ungraded_hkd=p.ungraded_hkd if p else None,
                psa_10_hkd=p.psa_10_hkd if p else None,
                source_url=p.source_url if p else None,
                card_image_url=p.card_image_url if p else None,
            )
            records.append(record)

        async with AsyncSessionLocal() as session:
            session.add_all(records)
            await session.commit()
    except Exception:
        pass  # Don't let history saving fail the scan response


async def scan_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> ScanResponseSchema:
    scan_id = str(uuid.uuid4())

    hkd_rate, detected = await asyncio.gather(
        _fetch_hkd_rate(),
        _detect_all_cards(image_bytes, mime_type),
    )

    if not detected:
        return ScanResponseSchema(cards=[], total_found=0, scan_id=scan_id)

    # Throttle PriceCharting requests to avoid 403s — max 3 concurrent
    sem = asyncio.Semaphore(3)

    async def _fetch_price_throttled(card: dict[str, Any]) -> tuple[ScannedCardPrices | None, str | None]:
        async with sem:
            return await _fetch_price(card, hkd_rate)

    price_results = await asyncio.gather(
        *[_fetch_price_throttled(card) for card in detected],
        return_exceptions=True,
    )

    # Collect PriceCharting image URLs and download them in parallel
    pc_image_urls = []
    for price_res in price_results:
        if isinstance(price_res, Exception):
            pc_image_urls.append(None)
        else:
            prices_obj, _ = price_res
            pc_image_urls.append(prices_obj.card_image_url if prices_obj else None)

    async def _maybe_download(url: str | None) -> str | None:
        if url:
            return await _download_image_as_b64(url)
        return None

    image_b64_results = await asyncio.gather(
        *[_maybe_download(url) for url in pc_image_urls],
        return_exceptions=True,
    )

    cards = []
    for card, price_res, pc_b64 in zip(detected, price_results, image_b64_results):
        if isinstance(price_res, Exception):
            prices, price_error = None, str(price_res)
        else:
            prices, price_error = price_res

        # Prefer PriceCharting card image (downloaded as base64); fallback to cropped image
        image_b64 = pc_b64 if isinstance(pc_b64, str) else None
        if not image_b64:
            image_b64 = _crop_card_image(image_bytes, mime_type, card.get("bbox"))
        cards.append(ScannedCard(
            name=card["name"],
            name_en=card["name_en"],
            number=card.get("number"),
            set_name=card.get("set_name"),
            set_code=card.get("set_code"),
            language=card["language"],
            rarity=card.get("rarity"),
            graded=card["graded"],
            grade_company=card.get("grade_company"),
            grade_value=card.get("grade_value"),
            is_first_edition=card["is_first_edition"],
            is_shadowless=card["is_shadowless"],
            confidence=card["confidence"],
            prices=prices,
            price_error=price_error,
            image_b64=image_b64,
        ))

    # Save to history in background (don't block response)
    asyncio.create_task(_save_scan_history(scan_id, cards))

    return ScanResponseSchema(cards=cards, total_found=len(cards), scan_id=scan_id)
