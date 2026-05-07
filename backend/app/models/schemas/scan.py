from pydantic import BaseModel


class ScannedCardPrices(BaseModel):
    ungraded: float | None
    grade_7: float | None
    grade_8: float | None
    grade_9: float | None
    grade_9_5: float | None
    psa_10: float | None
    bgs_10: float | None
    currency: str = "USD"
    # HKD equivalents
    ungraded_hkd: float | None = None
    grade_9_hkd: float | None = None
    grade_9_5_hkd: float | None = None
    psa_10_hkd: float | None = None
    bgs_10_hkd: float | None = None
    hkd_rate: float | None = None
    source_url: str | None
    # The price tier that matches the card's actual grade (USD and HKD)
    graded_price_usd: float | None = None
    graded_price_hkd: float | None = None
    # Card image URL from PriceCharting
    card_image_url: str | None = None


class ScannedCard(BaseModel):
    name: str
    name_en: str
    number: str | None
    set_name: str | None
    set_code: str | None
    language: str
    rarity: str | None
    graded: bool
    grade_company: str | None
    grade_value: str | None
    is_first_edition: bool
    is_shadowless: bool
    confidence: float
    prices: ScannedCardPrices | None
    price_error: str | None
    # Base64-encoded cropped image of this card (JPEG), if available
    image_b64: str | None = None


class ScanResponseSchema(BaseModel):
    cards: list[ScannedCard]
    total_found: int
    scan_id: str
