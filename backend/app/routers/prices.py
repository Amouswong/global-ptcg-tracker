from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.schemas.price import PriceHistoryResponseSchema, PriceResponseSchema
from app.services import price_service

router = APIRouter(prefix="/cards", tags=["prices"])


@router.get("/{card_id}/prices", response_model=PriceResponseSchema)
async def get_prices(
    card_id: str,
    condition: str = Query("NM", description="NM | LP | MP | PSA-10 | CGC-9.5 | BGS-9 ..."),
    db: AsyncSession = Depends(get_db),
):
    result = await price_service.get_prices(card_id, condition, db)
    if not result:
        raise HTTPException(status_code=404, detail="Card not found")
    return result


@router.get("/{card_id}/history", response_model=PriceHistoryResponseSchema)
async def get_price_history(
    card_id: str,
    condition: str = Query("NM"),
    range: str = Query("30d", pattern="^(7d|30d|3m)$"),
    db: AsyncSession = Depends(get_db),
):
    result = await price_service.get_price_history(card_id, condition, range, db)
    if not result:
        raise HTTPException(status_code=404, detail="Card not found")
    return result
