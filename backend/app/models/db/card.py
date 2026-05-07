from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import JSON, Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    set_id: Mapped[str] = mapped_column(String(64), nullable=False)
    set_name: Mapped[str] = mapped_column(String(255), nullable=False)
    series: Mapped[Optional[str]] = mapped_column(String(255))
    number: Mapped[Optional[str]] = mapped_column(String(16))
    rarity: Mapped[Optional[str]] = mapped_column(String(64))
    supertype: Mapped[Optional[str]] = mapped_column(String(64))
    subtypes: Mapped[Optional[List]] = mapped_column(JSON)
    hp: Mapped[Optional[str]] = mapped_column(String(8))
    image_url_small: Mapped[Optional[str]] = mapped_column(String(512))
    image_url_large: Mapped[Optional[str]] = mapped_column(String(512))
    artist: Mapped[Optional[str]] = mapped_column(String(255))
    release_date: Mapped[Optional[date]] = mapped_column(Date)
    phash: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    cached_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cache_ttl_hours: Mapped[int] = mapped_column(Integer, default=24)
