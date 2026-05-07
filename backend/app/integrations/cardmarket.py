"""
Cardmarket integration stub.
Real API: https://developer.cardmarket.com
Auth: OAuth1 (MWS API) — requires registered developer account.
Endpoint: GET /products/{productId}/articles
"""
from typing import Any


async def get_card_price(card_id: str, condition: str) -> dict[str, Any] | None:
    """Returns None — real implementation pending API key."""
    return None
