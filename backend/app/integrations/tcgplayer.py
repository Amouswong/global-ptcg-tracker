"""
TCGPlayer integration stub.
Real API: https://developer.tcgplayer.com
Auth: OAuth2 client credentials (Partner Program — requires application approval).
Endpoint: GET /pricing/product/{productId}
"""
from datetime import datetime, timezone
from typing import Any


async def get_card_price(card_id: str, condition: str) -> dict[str, Any] | None:
    """Returns None — real implementation pending API key."""
    return None
