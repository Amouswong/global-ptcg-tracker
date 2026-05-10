import asyncio
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.integrations import pricecharting, sneakdunk
from app.models.db.scan_history import ScanHistory

router = APIRouter(prefix="/history", tags=["history"])


class ManualScanRequest(BaseModel):
    name_en: str
    name: str
    number: str | None = None
    set_name: str | None = None
    language: str = "en"
    graded: bool = False
    grade_company: str | None = None
    grade_value: str | None = None
    confidence: float = 1.0
    source_url: str | None = None


@router.post("/manual")
async def add_manual_scan(
    req: ManualScanRequest,
    db: AsyncSession = Depends(get_db),
):
    """Manually add a card to scan history (from search)."""
    import httpx

    # Fetch PriceCharting and Sneakdunk prices concurrently
    ungraded_usd = None
    grade_7_usd = None
    grade_8_usd = None
    grade_9_usd = None
    grade_9_5_usd = None
    psa_10_usd = None
    bgs_10_usd = None
    ungraded_hkd = None
    grade_7_hkd = None
    grade_8_hkd = None
    grade_9_hkd = None
    grade_9_5_hkd = None
    psa_10_hkd = None
    bgs_10_hkd = None
    card_image_url = None
    snkrdunk_result = None

    async def fetch_pricecharting():
        nonlocal ungraded_usd, grade_7_usd, grade_8_usd, grade_9_usd
        nonlocal grade_9_5_usd, psa_10_usd, bgs_10_usd
        nonlocal ungraded_hkd, grade_7_hkd, grade_8_hkd, grade_9_hkd
        nonlocal grade_9_5_hkd, psa_10_hkd, bgs_10_hkd, card_image_url
        if not req.source_url:
            return
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                result = await pricecharting.fetch_prices_by_url(req.source_url, client)
                if result and result.get("prices"):
                    prices = result["prices"]
                    ungraded_usd = prices.get("ungraded")
                    grade_7_usd = prices.get("grade_7")
                    grade_8_usd = prices.get("grade_8")
                    grade_9_usd = prices.get("grade_9")
                    grade_9_5_usd = prices.get("grade_9_5")
                    psa_10_usd = prices.get("psa_10")
                    bgs_10_usd = prices.get("bgs_10")
                    hkd_rate = 7.8
                    if ungraded_usd: ungraded_hkd = round(ungraded_usd * hkd_rate, 1)
                    if grade_7_usd: grade_7_hkd = round(grade_7_usd * hkd_rate, 1)
                    if grade_8_usd: grade_8_hkd = round(grade_8_usd * hkd_rate, 1)
                    if grade_9_usd: grade_9_hkd = round(grade_9_usd * hkd_rate, 1)
                    if grade_9_5_usd: grade_9_5_hkd = round(grade_9_5_usd * hkd_rate, 1)
                    if psa_10_usd: psa_10_hkd = round(psa_10_usd * hkd_rate, 1)
                    if bgs_10_usd: bgs_10_hkd = round(bgs_10_usd * hkd_rate, 1)
                    card_image_url = result.get("card_image_url")
            except Exception:
                pass

    async def fetch_sneakdunk():
        nonlocal snkrdunk_result
        try:
            # Use Japanese name for JP cards, English otherwise
            name_ja = req.name if req.language == "ja" else None
            snkrdunk_result = await sneakdunk.search_card_price(
                name_en=req.name_en,
                name_ja=name_ja,
                number=req.number,
                set_code=req.set_name,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Sneakdunk fetch failed: %s", e)

    await asyncio.gather(fetch_pricecharting(), fetch_sneakdunk())

    # Create scan history record
    scan_id = str(uuid.uuid4())
    record = ScanHistory(
        id=str(uuid.uuid4()),
        scan_id=scan_id,
        name_en=req.name_en,
        name=req.name,
        set_name=req.set_name,
        number=req.number,
        language=req.language,
        graded=req.graded,
        grade_company=req.grade_company,
        grade_value=req.grade_value,
        confidence=req.confidence,
        ungraded_usd=ungraded_usd,
        grade_7_usd=grade_7_usd,
        grade_8_usd=grade_8_usd,
        grade_9_usd=grade_9_usd,
        grade_9_5_usd=grade_9_5_usd,
        psa_10_usd=psa_10_usd,
        bgs_10_usd=bgs_10_usd,
        ungraded_hkd=ungraded_hkd,
        grade_7_hkd=grade_7_hkd,
        grade_8_hkd=grade_8_hkd,
        grade_9_hkd=grade_9_hkd,
        grade_9_5_hkd=grade_9_5_hkd,
        psa_10_hkd=psa_10_hkd,
        bgs_10_hkd=bgs_10_hkd,
        source_url=req.source_url,
        sneakdunk_url=snkrdunk_result.get("url") if snkrdunk_result else None,
        sneakdunk_lowest_ask_jpy=snkrdunk_result.get("lowest_ask_jpy") if snkrdunk_result else None,
        sneakdunk_lowest_ask_hkd=snkrdunk_result.get("lowest_ask_hkd") if snkrdunk_result else None,
        sneakdunk_market_price_jpy=snkrdunk_result.get("market_price_jpy") if snkrdunk_result else None,
        sneakdunk_market_price_hkd=snkrdunk_result.get("market_price_hkd") if snkrdunk_result else None,
        card_image_url=card_image_url,
    )

    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "id": record.id,
        "scan_id": record.scan_id,
        "name_en": record.name_en,
        "name": record.name,
        "number": record.number,
        "graded": record.graded,
        "grade_company": record.grade_company,
        "grade_value": record.grade_value,
        "ungraded_usd": record.ungraded_usd,
        "grade_9_usd": record.grade_9_usd,
        "psa_10_usd": record.psa_10_usd,
        "ungraded_hkd": record.ungraded_hkd,
        "grade_9_hkd": record.grade_9_hkd,
        "psa_10_hkd": record.psa_10_hkd,
        "source_url": record.source_url,
        "sneakdunk_url": record.sneakdunk_url,
        "sneakdunk_lowest_ask_jpy": record.sneakdunk_lowest_ask_jpy,
        "sneakdunk_lowest_ask_hkd": record.sneakdunk_lowest_ask_hkd,
        "sneakdunk_market_price_jpy": record.sneakdunk_market_price_jpy,
        "sneakdunk_market_price_hkd": record.sneakdunk_market_price_hkd,
        "created_at": record.scanned_at.isoformat() if record.scanned_at else None,
    }


@router.get("")
async def get_scan_history(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Return recent scan history, newest first."""
    from sqlalchemy import desc

    result = await db.execute(
        select(ScanHistory)
        .order_by(desc(ScanHistory.scanned_at))
        .offset(offset)
        .limit(limit)
    )
    rows = result.scalars().all()
    return {
        "items": [
            {
                "id": r.id,
                "scan_id": r.scan_id,
                "name_en": r.name_en,
                "name": r.name,
                "set_name": r.set_name,
                "set_code": r.set_code,
                "number": r.number,
                "language": r.language,
                "rarity": r.rarity,
                "graded": r.graded,
                "grade_company": r.grade_company,
                "grade_value": r.grade_value,
                "confidence": r.confidence,
                "ungraded_usd": r.ungraded_usd,
                "psa_10_usd": r.psa_10_usd,
                "ungraded_hkd": r.ungraded_hkd,
                "psa_10_hkd": r.psa_10_hkd,
                "source_url": r.source_url,
                "sneakdunk_url": r.sneakdunk_url,
                "sneakdunk_lowest_ask_jpy": r.sneakdunk_lowest_ask_jpy,
                "sneakdunk_lowest_ask_hkd": r.sneakdunk_lowest_ask_hkd,
                "sneakdunk_market_price_jpy": r.sneakdunk_market_price_jpy,
                "sneakdunk_market_price_hkd": r.sneakdunk_market_price_hkd,
                "card_image_url": r.card_image_url,
                "scanned_at": r.scanned_at.isoformat() if r.scanned_at else None,
            }
            for r in rows
        ],
        "total": len(rows),
        "offset": offset,
        "limit": limit,
    }


@router.delete("/{record_id}")
async def delete_history_record(
    record_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single scan history record."""
    result = await db.execute(select(ScanHistory).where(ScanHistory.id == record_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    await db.delete(record)
    await db.commit()
    return {"deleted": record_id}
