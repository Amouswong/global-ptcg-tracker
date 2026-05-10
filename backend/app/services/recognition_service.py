import asyncio
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import gemini_vision, sneakdunk, tcgdex
from app.models.db.recognition_log import RecognitionLog
from app.models.db.scan_history import ScanHistory
from app.models.schemas.card import CardSummarySchema
from app.models.schemas.recognition import RecognitionCandidateSchema, RecognitionResponseSchema
from app.services import card_service

logger = logging.getLogger(__name__)


async def identify_card(image_bytes: bytes, content_type: str, db: AsyncSession) -> RecognitionResponseSchema:
    recognition_id = str(uuid.uuid4())

    vision_result = await gemini_vision.identify_single_card(image_bytes, content_type)

    candidates: list[RecognitionCandidateSchema] = []

    if vision_result and not vision_result.get("not_a_card"):
        name_en = vision_result.get("name_en")
        name_orig = vision_result.get("name")
        number = vision_result.get("number")
        language = vision_result.get("language", "en")

        search_tasks = []

        # Always search English name via pokemontcg.io
        if name_en:
            search_tasks.append(card_service.search_cards(name_en, 1, 5, db))
        elif name_orig and language == "en":
            search_tasks.append(card_service.search_cards(name_orig, 1, 5, db))

        # For Japanese cards also search TCGdex with original name
        if language == "ja" and name_orig:
            search_tasks.append(_tcgdex_search(name_orig, db))

        # If we have a card number, search by number too
        if number and tcgdex.looks_like_number(number):
            search_tasks.append(_number_search(number, db))

        results = await asyncio.gather(*search_tasks, return_exceptions=True)

        seen: set[str] = set()
        for result in results:
            if isinstance(result, Exception):
                continue
            cards = result.results if hasattr(result, "results") else result
            for card in cards:
                if card.id not in seen:
                    seen.add(card.id)
                    candidates.append(
                        RecognitionCandidateSchema(
                            card=card,
                            confidence=vision_result.get("confidence", 0.95),
                            match_method="gemini_vision",
                        )
                    )

    candidates = candidates[:3]
    identified = bool(candidates)
    top_card = candidates[0].card if identified else None
    top_confidence = candidates[0].confidence if candidates else 0.0

    db.add(
        RecognitionLog(
            id=recognition_id,
            matched_card_id=top_card.id if top_card else None,
            confidence=top_confidence,
            match_method="gemini_vision" if candidates else None,
            image_hash=None,
        )
    )

    # Save top card to scan history
    if top_card and vision_result:
        try:
            language = vision_result.get("language", "en")
            name_ja = vision_result.get("name") if language == "ja" else None
            sd = None
            try:
                sd = await sneakdunk.search_card_price(
                    name_en=top_card.name,
                    name_ja=name_ja,
                    number=top_card.number,
                    set_code=None,
                )
            except Exception as e:
                logger.warning("Sneakdunk fetch failed for %s: %s", top_card.name, e)

            db.add(ScanHistory(
                id=str(uuid.uuid4()),
                scan_id=recognition_id,
                name_en=top_card.name,
                name=vision_result.get("name") or top_card.name,
                set_name=top_card.set_name,
                number=top_card.number,
                language=language,
                rarity=top_card.rarity,
                graded=False,
                confidence=top_confidence,
                card_image_url=top_card.image_url_small,
                sneakdunk_url=sd.get("url") if sd else None,
                sneakdunk_lowest_ask_jpy=sd.get("lowest_ask_jpy") if sd else None,
                sneakdunk_lowest_ask_hkd=sd.get("lowest_ask_hkd") if sd else None,
                sneakdunk_market_price_jpy=sd.get("market_price_jpy") if sd else None,
                sneakdunk_market_price_hkd=sd.get("market_price_hkd") if sd else None,
            ))
        except Exception:
            logger.exception("Failed to save recognition result to scan history")

    await db.commit()

    return RecognitionResponseSchema(
        identified=identified,
        confidence=top_confidence,
        card=top_card,
        candidates=candidates,
        recognition_id=recognition_id,
    )


async def _tcgdex_search(name: str, db: AsyncSession) -> list[CardSummarySchema]:
    data = await tcgdex.search_by_name(name, lang="ja", page=1, page_size=5)
    cards = []
    for card_data in data["cards"]:
        await card_service._upsert_card(card_data, db)
        cards.append(CardSummarySchema(
            id=card_data["id"],
            name=card_data["name"],
            set_name=card_data.get("set_name", ""),
            number=card_data.get("number"),
            rarity=card_data.get("rarity"),
            image_url_small=card_data.get("image_url_small"),
        ))
    return cards


async def _number_search(number: str, db: AsyncSession) -> list[CardSummarySchema]:
    result = await card_service.search_cards(number, 1, 5, db)
    return list(result.results)
