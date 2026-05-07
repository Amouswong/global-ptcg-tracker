import hashlib
import random
from datetime import datetime, timezone
from typing import Any


PLATFORM_CONFIGS = [
    {"platform": "TCGPlayer", "weight": 0.35, "base_multiplier": 1.0},
    {"platform": "Cardmarket", "weight": 0.30, "base_multiplier": 0.92},
    {"platform": "eBay", "weight": 0.25, "base_multiplier": 1.05},
]

CONDITION_MULTIPLIERS = {"NM": 1.0, "LP": 0.75, "MP": 0.55}

BASE_PRICES = {
    "common": 0.25,
    "uncommon": 0.50,
    "rare": 2.50,
    "holo rare": 5.0,
    "ultra rare": 15.0,
    "secret rare": 40.0,
    "hyper rare": 60.0,
    "illustration rare": 20.0,
    "special illustration rare": 80.0,
}


def _base_price_for_rarity(rarity: str | None) -> float:
    if rarity is None:
        return 1.0
    return BASE_PRICES.get(rarity.lower(), 2.0)


def get_mock_price(card_id: str, platform: str, condition: str, rarity: str | None = None) -> float:
    seed = hashlib.md5(f"{card_id}:{platform}:{condition}".encode()).hexdigest()
    rng = random.Random(seed)
    base = _base_price_for_rarity(rarity)
    variance = rng.uniform(0.85, 1.15)
    condition_mult = CONDITION_MULTIPLIERS.get(condition, 1.0)
    return round(base * variance * condition_mult, 2)


def get_all_mock_prices(
    card_id: str, condition: str, rarity: str | None = None
) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    results = []
    for cfg in PLATFORM_CONFIGS:
        price = get_mock_price(card_id, cfg["platform"], condition, rarity)
        results.append(
            {
                "platform": cfg["platform"],
                "price": price,
                "currency": "USD",
                "url": None,
                "weight": cfg["weight"],
                "last_updated": now,
            }
        )
    return results
