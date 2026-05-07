import redis.asyncio as aioredis

from app.config import settings

redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    return redis_client


async def init_redis():
    global redis_client
    if settings.redis_url:
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)


async def close_redis():
    if redis_client:
        await redis_client.aclose()
