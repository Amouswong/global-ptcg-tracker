from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.schemas.recognition import RecognitionResponseSchema
from app.redis_client import get_redis
from app.services import recognition_service

router = APIRouter(prefix="/recognition", tags=["recognition"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
RATE_LIMIT_MAX = 10
RATE_LIMIT_WINDOW = 60


@router.post("/identify", response_model=RecognitionResponseSchema)
async def identify_card(
    request: Request,
    image: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    await _check_rate_limit(client_ip)

    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=422, detail="Only JPEG, PNG, or WebP images are accepted")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="Image too large (max 10MB)")

    return await recognition_service.identify_card(image_bytes, image.content_type or "image/jpeg", db)


async def _check_rate_limit(ip: str) -> None:
    redis = await get_redis()
    if not redis:
        return
    key = f"ratelimit:recognition:{ip}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, RATE_LIMIT_WINDOW)
    if count > RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Too many requests — try again in a minute")
