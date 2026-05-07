from fastapi import APIRouter, Query

from app.integrations import pricecharting

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/pricecharting")
async def search_pricecharting(
    q: str = Query(..., min_length=2, description="Card name search query"),
    limit: int = Query(10, ge=1, le=20),
):
    """
    Search PriceCharting directly for cards.
    Returns raw PriceCharting search results with product URLs.
    """
    import httpx

    async with httpx.AsyncClient(timeout=15.0) as client:
        results = await pricecharting.search(q, client, limit=limit)

    return {
        "query": q,
        "results": results,
        "total": len(results),
    }
