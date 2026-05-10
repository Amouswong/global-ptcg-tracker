from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models.db import Card, PriceHistory, RecognitionLog, ScanHistory, TrackedCard  # noqa: F401 — ensures models are imported before create_all
from app.redis_client import close_redis, init_redis
from app.routers import cards_router, prices_router, recognition_router, scan_router
from app.routers.history import router as history_router
from app.routers.search import router as search_router
from app.routers.tracking import router as tracking_router


async def _migrate(conn):
    from app.database import Base
    await conn.run_sync(Base.metadata.create_all)
    # Add sneakdunk columns if they don't exist (for existing deployments)
    new_columns = [
        ("sneakdunk_url", "TEXT"),
        ("sneakdunk_lowest_ask_jpy", "FLOAT"),
        ("sneakdunk_lowest_ask_hkd", "FLOAT"),
        ("sneakdunk_market_price_jpy", "FLOAT"),
        ("sneakdunk_market_price_hkd", "FLOAT"),
    ]
    for col, col_type in new_columns:
        await conn.execute(
            __import__("sqlalchemy").text(
                f"ALTER TABLE scan_history ADD COLUMN IF NOT EXISTS {col} {col_type}"
            )
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    async with engine.begin() as conn:
        await _migrate(conn)
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="Global PTCG Tracker API",
    version="1.0.0",
    description="Pokemon TCG global price aggregation API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://global-ptcg-tracker.vercel.app", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cards_router, prefix="/api/v1")
app.include_router(prices_router, prefix="/api/v1")
app.include_router(recognition_router, prefix="/api/v1")
app.include_router(scan_router, prefix="/api/v1")
app.include_router(history_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(tracking_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/debug/gemini")
async def debug_gemini():
    import httpx
    from app.config import settings
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    payload = {
        "contents": [{"parts": [{"text": "Say hello"}]}],
        "generationConfig": {"maxOutputTokens": 10},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, params={"key": settings.gemini_api_key}, json=payload)
    return {"status": resp.status_code, "body": resp.json(), "key_prefix": settings.gemini_api_key[:10]}
