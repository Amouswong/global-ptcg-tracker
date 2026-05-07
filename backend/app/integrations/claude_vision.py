import base64
import json
import re
from typing import Any

import httpx

from app.config import settings


async def identify_card_from_image(image_bytes: bytes, content_type: str) -> dict[str, Any] | None:
    """
    Returns dict with keys: name, name_en, number, set, language
    or {"not_a_card": True} if image isn't a Pokemon card.
    Returns None if API key not configured or request fails.
    """
    if not settings.anthropic_api_key:
        return None

    b64 = base64.standard_b64encode(image_bytes).decode()

    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 200,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": content_type,
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a Pokemon Trading Card Game card. "
                            "Reply with ONLY a JSON object (no markdown) with these fields: "
                            "name (card name in the original language printed on the card), "
                            "name_en (English name if you can identify it, else null), "
                            "number (card number e.g. '025' or 'SV2a-025', else null), "
                            "set (set name or code, else null), "
                            "language ('en', 'ja', 'ko', 'zh', etc). "
                            "If this is not a Pokemon card, reply {\"not_a_card\": true}."
                        ),
                    },
                ],
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()

        text = resp.json()["content"][0]["text"].strip()
        # Strip markdown code fences if model wraps in ```json ... ```
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        return json.loads(text)
    except Exception:
        return None
