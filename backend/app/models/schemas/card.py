from datetime import date
from typing import Any

from pydantic import BaseModel


class CardSummarySchema(BaseModel):
    id: str
    name: str
    set_name: str
    number: str | None
    rarity: str | None
    image_url_small: str | None

    model_config = {"from_attributes": True}


class CardDetailSchema(CardSummarySchema):
    set_id: str
    series: str | None
    supertype: str | None
    subtypes: list[str] | None
    hp: str | None
    image_url_large: str | None
    artist: str | None
    release_date: date | None


class CardSearchResponseSchema(BaseModel):
    results: list[CardSummarySchema]
    total: int
    page: int
    page_size: int
