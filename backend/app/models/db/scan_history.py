from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # scan_id
    scan_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    set_name: Mapped[Optional[str]] = mapped_column(String(255))
    set_code: Mapped[Optional[str]] = mapped_column(String(32))
    number: Mapped[Optional[str]] = mapped_column(String(32))
    language: Mapped[str] = mapped_column(String(8), default="en")
    rarity: Mapped[Optional[str]] = mapped_column(String(64))
    graded: Mapped[bool] = mapped_column(default=False)
    grade_company: Mapped[Optional[str]] = mapped_column(String(16))
    grade_value: Mapped[Optional[str]] = mapped_column(String(8))
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    # Price snapshot
    ungraded_usd: Mapped[Optional[float]] = mapped_column(Float)
    grade_7_usd: Mapped[Optional[float]] = mapped_column(Float)
    grade_8_usd: Mapped[Optional[float]] = mapped_column(Float)
    grade_9_usd: Mapped[Optional[float]] = mapped_column(Float)
    grade_9_5_usd: Mapped[Optional[float]] = mapped_column(Float)
    psa_10_usd: Mapped[Optional[float]] = mapped_column(Float)
    bgs_10_usd: Mapped[Optional[float]] = mapped_column(Float)
    ungraded_hkd: Mapped[Optional[float]] = mapped_column(Float)
    grade_7_hkd: Mapped[Optional[float]] = mapped_column(Float)
    grade_8_hkd: Mapped[Optional[float]] = mapped_column(Float)
    grade_9_hkd: Mapped[Optional[float]] = mapped_column(Float)
    grade_9_5_hkd: Mapped[Optional[float]] = mapped_column(Float)
    psa_10_hkd: Mapped[Optional[float]] = mapped_column(Float)
    bgs_10_hkd: Mapped[Optional[float]] = mapped_column(Float)
    # PriceCharting source URL
    source_url: Mapped[Optional[str]] = mapped_column(String(512))
    # Card image (PriceCharting URL)
    card_image_url: Mapped[Optional[str]] = mapped_column(String(512))
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
