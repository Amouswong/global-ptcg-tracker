from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.schemas.card import CardDetailSchema, CardSearchResponseSchema
from app.services import card_service

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/search", response_model=CardSearchResponseSchema)
async def search_cards(
    q: str = Query(..., min_length=2, description="Card name search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    return await card_service.search_cards(q, page, page_size, db)


@router.get("/{card_id}", response_model=CardDetailSchema)
async def get_card(card_id: str, db: AsyncSession = Depends(get_db)):
    card = await card_service.get_card(card_id, db)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card
