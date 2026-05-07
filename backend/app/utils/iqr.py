from dataclasses import dataclass


@dataclass
class PlatformRawPrice:
    platform: str
    price: float
    weight: float


@dataclass
class PlatformProcessedPrice:
    platform: str
    price: float
    weight: float
    is_outlier: bool


def compute_composite_price(raw_prices: list[PlatformRawPrice]) -> tuple[float, list[PlatformProcessedPrice]]:
    """IQR outlier removal + platform-weighted average."""
    if not raw_prices:
        return 0.0, []

    prices = [p.price for p in raw_prices]

    if len(prices) < 3:
        processed = [PlatformProcessedPrice(p.platform, p.price, p.weight, False) for p in raw_prices]
        total_weight = sum(p.weight for p in processed)
        composite = sum(p.price * p.weight for p in processed) / total_weight if total_weight else 0.0
        return round(composite, 2), processed

    sorted_prices = sorted(prices)
    n = len(sorted_prices)
    q1 = sorted_prices[n // 4]
    q3 = sorted_prices[(3 * n) // 4]
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    processed = [
        PlatformProcessedPrice(
            platform=p.platform,
            price=p.price,
            weight=p.weight,
            is_outlier=p.price < lower or p.price > upper,
        )
        for p in raw_prices
    ]

    inliers = [p for p in processed if not p.is_outlier]
    if not inliers:
        inliers = processed  # fallback: all outliers means don't filter

    total_weight = sum(p.weight for p in inliers)
    composite = sum(p.price * p.weight for p in inliers) / total_weight if total_weight else 0.0
    return round(composite, 2), processed
