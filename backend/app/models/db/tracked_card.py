from sqlalchemy import DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TrackedCard(Base):
    __tablename__ = "tracked_cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    grade: Mapped[str] = mapped_column(String(32), nullable=False)  # ungraded, psa_10, psa_9, bgs_10, cgc_10
    current_price_usd: Mapped[float | None] = mapped_column(Float)
    current_price_hkd: Mapped[float | None] = mapped_column(Float)
    last_updated: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
