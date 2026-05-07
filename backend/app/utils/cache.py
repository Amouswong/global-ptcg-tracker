import json
from typing import Any, Optional

from app.redis_client import get_redis


async def cache_get(key: str) -> Optional[Any]:
    redis = await get_redis()
    if not redis:
        return None
    value = await redis.get(key)
    if value is None:
        return None
    return json.loads(value)


async def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    redis = await get_redis()
    if not redis:
        return
    await redis.set(key, json.dumps(value, default=str), ex=ttl_seconds)


async def cache_delete(key: str) -> None:
    redis = await get_redis()
    if redis:
        await redis.delete(key)
