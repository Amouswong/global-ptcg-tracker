from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.models.schemas.scan import ScannedCard, ScanResponseSchema
from app.services import scan_service

router = APIRouter(prefix="/scan", tags=["scan"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("", response_model=ScanResponseSchema)
async def scan_cards(request: Request, image: UploadFile):
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Only JPEG, PNG, or WebP images are accepted")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="Image too large (max 10MB)")

    return await scan_service.scan_image(image_bytes, image.content_type or "image/jpeg")


class RescanCardRequest(BaseModel):
    name_en: str
    name: str
    set_name: str | None = None
    set_code: str | None = None
    number: str | None = None
    language: str = "en"
    graded: bool = False
    grade_company: str | None = None
    grade_value: str | None = None
    rarity: str | None = None
    is_first_edition: bool = False
    is_shadowless: bool = False
    confidence: float = 1.0
    # Preserve original image_b64 if already cropped
    image_b64: str | None = None


@router.post("/rescan-card", response_model=ScannedCard)
async def rescan_card(req: RescanCardRequest):
    """Re-fetch prices for a single card (e.g. after user manually corrects card info)."""
    card_dict = req.model_dump()
    hkd_rate = await scan_service._fetch_hkd_rate()
    prices, price_error = await scan_service._fetch_price(card_dict, hkd_rate)
    return ScannedCard(
        name=req.name,
        name_en=req.name_en,
        number=req.number,
        set_name=req.set_name,
        set_code=req.set_code,
        language=req.language,
        rarity=req.rarity,
        graded=req.graded,
        grade_company=req.grade_company,
        grade_value=req.grade_value,
        is_first_edition=req.is_first_edition,
        is_shadowless=req.is_shadowless,
        confidence=req.confidence,
        prices=prices,
        price_error=price_error,
        image_b64=req.image_b64,
    )
