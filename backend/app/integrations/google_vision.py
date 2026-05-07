"""
Google Cloud Vision API integration.
Set GOOGLE_APPLICATION_CREDENTIALS env var to a service account JSON key path.
Requires: pip install google-cloud-vision
GCP setup: console.cloud.google.com → Enable "Cloud Vision API" → Create Service Account
"""
from typing import Any

from app.config import settings


async def extract_text_from_image(image_bytes: bytes) -> list[str]:
    """Return a list of text strings detected in the image."""
    if not settings.vision_api_enabled:
        return []
    try:
        from google.cloud import vision  # type: ignore

        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.text_detection(image=image)
        texts = response.text_annotations
        if not texts:
            return []
        return [t.description for t in texts]
    except Exception:
        return []
