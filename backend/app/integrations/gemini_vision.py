"""
Gemini Vision module for PTCG card recognition.

Accepts a photo containing one or more Pokemon cards and returns structured
data for each detected card: name, set, number, language, grading status.
Results feed directly into the PriceCharting scraper.
"""

import asyncio
import base64
import json
import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_FLASH_URL = (
    "https://generativelanguage.googleapis.com/v1/models"
    "/gemini-2.0-flash:generateContent"
)
_PRO_URL = (
    "https://generativelanguage.googleapis.com/v1/models"
    "/gemini-2.0-flash:generateContent"
)

_LOW_CONFIDENCE_THRESHOLD = 0.7

_CARD_FIELDS = """Fields:
- name: card name exactly as printed on the card (read from slab label first if graded)
- name_en: English name (translate if non-English, else same as name)
- number: collector number e.g. "130/090", "173/165" — read from slab label first, then card bottom
- set_name: full English set name — derive from the set code on the slab label (e.g. "SV9 JP" → "Surging Sparks", "SV5a JP" → "Crimson Haze", "SM12a" → "Tag Team GX All Stars"). Use your Pokemon TCG knowledge to map set codes accurately.
- set_code: set code exactly as shown (e.g. "SV9", "SV5a", "SM12a")
- language: ISO code — "en", "ja", "ko", "zh-tw", "zh-cn", "de", "fr", "it", "es", "pt". If slab label says "JP" → "ja", "EN" → "en"
- graded: true if card is in a PSA/BGS/CGC slab
- grade_company: "PSA", "BGS", "CGC", or null
- grade_value: grade as string e.g. "10", "9.5" — read from slab label
- rarity: read from slab label first (e.g. "ULTRA RARE", "SPECIAL ART RARE"), then card symbol. Normalise to: "Common", "Uncommon", "Rare", "Rare Holo", "Double Rare", "Ultra Rare", "Special Illustration Rare", "Hyper Rare", "Promo", "SR", "SAR", "AR", "RR", "HR"
- is_first_edition: true if 1st Edition stamp visible
- is_shadowless: true if Base Set shadowless variant
- confidence: 0.0–1.0

IMPORTANT for graded cards: The PSA/BGS/CGC slab label at the top contains the most reliable data — card name, set, number, rarity, and grade are printed clearly. Always read the label text first before analysing the card art."""

_CARD_FIELDS_WITH_BBOX = _CARD_FIELDS + """
- bbox: bounding box of this card in the image as [x_min, y_min, x_max, y_max] in pixel coordinates (top-left origin). Estimate as accurately as possible."""

_SINGLE_CARD_PROMPT = f"""You are a Pokemon TCG expert. Analyze this card image and return ONLY a valid JSON object with EXACTLY these field names. Do NOT use any other field names.

{_CARD_FIELDS}

CRITICAL: Use ONLY the exact field names listed above (name, name_en, number, set_name, set_code, language, graded, grade_company, grade_value, rarity, is_first_edition, is_shadowless, confidence). Do NOT invent new field names like "pokemon_name", "year", "set_promo", etc.

Return ONLY the JSON object. No markdown, no explanation, no ```json fences.

If this is NOT a Pokemon card, return: {{"not_a_card": true}}"""

_MULTI_CARD_PROMPT = f"""You are a Pokemon TCG expert. Analyze this image and identify EVERY Pokemon card visible.

Return ONLY a valid JSON array. Each element must have EXACTLY these field names:

{_CARD_FIELDS_WITH_BBOX}

CRITICAL: Use ONLY the exact field names listed above (name, name_en, number, set_name, set_code, language, graded, grade_company, grade_value, rarity, is_first_edition, is_shadowless, confidence, bbox). Do NOT use field names like "pokemon_name", "year", "set_promo", "grade", "psa_cert_number" etc.

Return ONLY the JSON array with no markdown, no explanation, no ```json fences.

If no Pokemon cards are visible, return: []"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    # Remove opening fence: ```json or ``` optionally followed by newline
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    # Remove closing fence
    text = re.sub(r"\n?```\s*$", "", text)
    # If still wrapped (e.g. extra whitespace), find first [ or {
    start = min(
        (text.find(c) for c in ("[", "{") if text.find(c) != -1),
        default=0,
    )
    text = text[start:]
    return text.strip()


def _build_payload(image_b64: str, mime_type: str, multi: bool) -> dict[str, Any]:
    return {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_b64,
                        }
                    },
                    {"text": _MULTI_CARD_PROMPT if multi else _SINGLE_CARD_PROMPT},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 32768,
        },
    }


def _normalise_card(raw: dict[str, Any]) -> dict[str, Any]:
    """Ensure all expected keys exist with sensible defaults."""
    bbox = raw.get("bbox")
    # Validate bbox: must be a list/tuple of 4 numbers
    if bbox and isinstance(bbox, (list, tuple)) and len(bbox) == 4:
        try:
            bbox = [float(v) for v in bbox]
        except (TypeError, ValueError):
            bbox = None
    else:
        bbox = None

    return {
        "name": raw.get("name", ""),
        "name_en": raw.get("name_en") or raw.get("name", ""),
        "number": raw.get("number"),
        "set_name": raw.get("set_name"),
        "set_code": raw.get("set_code"),
        "language": raw.get("language", "en"),
        "graded": bool(raw.get("graded", False)),
        "grade_company": raw.get("grade_company"),
        "grade_value": raw.get("grade_value"),
        "rarity": raw.get("rarity"),
        "is_first_edition": bool(raw.get("is_first_edition", False)),
        "is_shadowless": bool(raw.get("is_shadowless", False)),
        "confidence": float(raw.get("confidence", 0.0)),
        "bbox": bbox,
    }


async def _call_gemini(
    url: str,
    payload: dict[str, Any],
    api_key: str,
    max_retries: int = 3,
) -> tuple[list[dict[str, Any]] | dict[str, Any] | None, bool]:
    """Call Gemini and return (parsed JSON, was_truncated). Retries on 503."""
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    url,
                    params={"key": api_key},
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                # 503 = overloaded, retry with backoff
                if resp.status_code == 503:
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    logger.error("Gemini 503 after retries: %s", url)
                    return None, False
                if not resp.is_success:
                    logger.error("Gemini HTTP %s: %s", resp.status_code, resp.text[:500])
                    resp.raise_for_status()
                resp.raise_for_status()
            data = resp.json()
            # Check for API-level error in response body
            if "error" in data:
                logger.error("Gemini API error: %s", data["error"])
                if data["error"].get("code") == 503 and attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return None, False
            candidates = data.get("candidates", [])
            if not candidates:
                logger.warning("Gemini returned no candidates. promptFeedback: %s", data.get("promptFeedback"))
                return None, False
            candidate = candidates[0]
            truncated = candidate.get("finishReason") == "MAX_TOKENS"
            parts = candidate.get("content", {}).get("parts", [])
            if not parts:
                return None, False
            text = parts[0].get("text", "")
            text = _strip_fences(text)
            try:
                return json.loads(text), truncated
            except json.JSONDecodeError as e:
                logger.error("Gemini JSON parse error: %s | text: %s", e, text[:300])
                return None, truncated
        except Exception as e:
            logger.error("Gemini call exception (attempt %s): %s", attempt, e)
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
                continue
            return None, False
    return None, False


async def identify_cards(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    multi: bool = True,
) -> list[dict[str, Any]]:
    if not settings.gemini_api_key:
        return []

    b64 = base64.standard_b64encode(image_bytes).decode()
    payload = _build_payload(b64, mime_type, multi)

    parsed, truncated = await _call_gemini(_FLASH_URL, payload, settings.gemini_api_key)

    # If Flash failed (None) or was truncated, try Pro immediately
    if parsed is None or truncated:
        parsed_pro, _ = await _call_gemini(_PRO_URL, payload, settings.gemini_api_key)
        if parsed_pro is not None:
            parsed = parsed_pro
            truncated = False

    if parsed is None:
        return []

    if isinstance(parsed, dict):
        cards_raw = [] if parsed.get("not_a_card") else [parsed]
    elif isinstance(parsed, list):
        cards_raw = [c for c in parsed if not c.get("not_a_card")]
    else:
        return []

    # If still truncated or low confidence, retry with Pro (if not already tried)
    needs_pro = truncated or (
        cards_raw and any(float(c.get("confidence", 0)) < _LOW_CONFIDENCE_THRESHOLD for c in cards_raw)
    )
    if needs_pro:
        parsed_pro, _ = await _call_gemini(_PRO_URL, payload, settings.gemini_api_key)
        if parsed_pro is not None:
            if isinstance(parsed_pro, dict):
                cards_raw = [] if parsed_pro.get("not_a_card") else [parsed_pro]
            elif isinstance(parsed_pro, list):
                cards_raw = [c for c in parsed_pro if not c.get("not_a_card")]

    return [_normalise_card(c) for c in cards_raw]


async def identify_cards_with_truncation(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
) -> tuple[list[dict[str, Any]], bool]:
    """Like identify_cards but also returns whether the output was truncated."""
    if not settings.gemini_api_key:
        return [], False

    b64 = base64.standard_b64encode(image_bytes).decode()
    payload = _build_payload(b64, mime_type, multi=True)

    parsed, truncated = await _call_gemini(_FLASH_URL, payload, settings.gemini_api_key)

    # If Flash failed or was truncated, try Pro
    if parsed is None or truncated:
        parsed_pro, truncated_pro = await _call_gemini(_PRO_URL, payload, settings.gemini_api_key)
        if parsed_pro is not None:
            parsed = parsed_pro
            truncated = truncated_pro

    if parsed is None:
        return [], False

    if isinstance(parsed, list):
        cards_raw = [c for c in parsed if not c.get("not_a_card")]
    else:
        cards_raw = []

    return [_normalise_card(c) for c in cards_raw], truncated


async def identify_single_card(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
) -> dict[str, Any] | None:
    """Convenience wrapper for single-card images. Returns None if not found."""
    results = await identify_cards(image_bytes, mime_type, multi=False)
    return results[0] if results else None
