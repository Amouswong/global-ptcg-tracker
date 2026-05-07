from app.routers.cards import router as cards_router
from app.routers.prices import router as prices_router
from app.routers.recognition import router as recognition_router
from app.routers.scan import router as scan_router

__all__ = ["cards_router", "prices_router", "recognition_router", "scan_router"]
