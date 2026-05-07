from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RecognitionLog(Base):
    __tablename__ = "recognition_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    matched_card_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("cards.id"), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3))
    match_method: Mapped[Optional[str]] = mapped_column(String(32))
    image_hash: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
