from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class PlatformPriceSchema(BaseModel):
    platform: str
    price: float
    currency: str
    url: str | None
    weight: float
    is_outlier: bool
    last_updated: datetime


class GradedPriceSchema(BaseModel):
    company: str          # PSA, CGC, BGS
    grade: float          # 10, 9.5, 9, ...
    currency: str
    low: float | None
    mid: float | None
    high: float | None
    market: float | None
    is_perfect: bool
    trend_7d: float | None
    trend_30d: float | None


class PriceResponseSchema(BaseModel):
    card_id: str
    condition: str
    currency: str
    composite_price: float
    composite_method: str
    platforms: list[PlatformPriceSchema]
    graded: list[GradedPriceSchema] = []
    has_japanese_price: bool = False
    cached: bool
    cache_expires_at: datetime | None


class HistoryDataPointSchema(BaseModel):
    date: date
    composite_price: float
    tcgplayer_price: float | None
    cardmarket_price: float | None
    ebay_price: float | None


class PriceHistoryResponseSchema(BaseModel):
    card_id: str
    condition: str
    range: str
    data_points: list[HistoryDataPointSchema]
