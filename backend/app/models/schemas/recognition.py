from pydantic import BaseModel

from app.models.schemas.card import CardSummarySchema


class RecognitionCandidateSchema(BaseModel):
    card: CardSummarySchema
    confidence: float
    match_method: str


class RecognitionResponseSchema(BaseModel):
    identified: bool
    confidence: float
    card: CardSummarySchema | None
    candidates: list[RecognitionCandidateSchema]
    recognition_id: str
