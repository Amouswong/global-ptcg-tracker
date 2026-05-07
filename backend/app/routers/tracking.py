import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.integrations import pricecharting
from app.models.db.tracked_card import TrackedCard

router = APIRouter(prefix="/tracking", tags=["tracking"])


class TrackCardRequest(BaseModel):
    url: str
    name: str
    grade: str  # ungraded, psa_10, psa_9, bgs_10, cgc_10


@router.post("")
async def track_card(
    req: TrackCardRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add a card to price tracking with selected grade."""
    import httpx

    # Fetch current price from PriceCharting
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            result = await pricecharting.fetch_prices_by_url(req.url, client)
        except Exception:
            result = None

    current_price_usd = None
    current_price_hkd = None

    if result and result.get("prices"):
        prices = result["prices"]
        # Map grade to price field
        grade_map = {
            "ungraded": "ungraded",
            "psa_10": "psa_10",
            "psa_9": "grade_9",
            "bgs_10": "bgs_10",
            "cgc_10": "psa_10",  # Use PSA 10 as fallback for CGC 10
        }
        price_field = grade_map.get(req.grade, "ungraded")
        current_price_usd = prices.get(price_field)

        # Convert to HKD (simple conversion, rate = 7.8)
        if current_price_usd:
            current_price_hkd = round(current_price_usd * 7.8, 1)

    # Save to database
    tracked = TrackedCard(
        id=str(uuid.uuid4()),
        name=req.name,
        url=req.url,
        grade=req.grade,
        current_price_usd=current_price_usd,
        current_price_hkd=current_price_hkd,
    )

    db.add(tracked)
    await db.commit()
    await db.refresh(tracked)

    return {
        "id": tracked.id,
        "name": tracked.name,
        "url": tracked.url,
        "grade": tracked.grade,
        "current_price_usd": tracked.current_price_usd,
        "current_price_hkd": tracked.current_price_hkd,
        "created_at": tracked.created_at.isoformat() if tracked.created_at else None,
    }


@router.get("")
async def get_tracked_cards(
    db: AsyncSession = Depends(get_db),
):
    """Get all tracked cards."""
    result = await db.execute(select(TrackedCard).order_by(TrackedCard.created_at.desc()))
    cards = result.scalars().all()

    return {
        "cards": [
            {
                "id": c.id,
                "name": c.name,
                "url": c.url,
                "grade": c.grade,
                "current_price_usd": c.current_price_usd,
                "current_price_hkd": c.current_price_hkd,
                "last_updated": c.last_updated.isoformat() if c.last_updated else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in cards
        ],
        "total": len(cards),
    }


@router.delete("/{card_id}")
async def delete_tracked_card(
    card_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove a card from tracking."""
    result = await db.execute(select(TrackedCard).where(TrackedCard.id == card_id))
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    await db.delete(card)
    await db.commit()

    return {"deleted": card_id}
