"""
eBay integration stub.
Real API: https://developer.ebay.com
Auth: OAuth2 app credentials (Browse API / Finding API).
Endpoint: GET /buy/browse/v1/item_summary/search?q={card_name}&category_ids=2536
"""
from typing import Any


async def get_card_price(card_id: str, condition: str) -> dict[str, Any] | None:
    """Returns None — real implementation pending API key."""
    return None
