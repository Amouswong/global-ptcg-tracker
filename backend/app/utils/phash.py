import io
from typing import Optional

import imagehash
from PIL import Image


def compute_phash(image_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return str(imagehash.phash(image))


def hash_distance(hash1: str, hash2: str) -> int:
    return imagehash.hex_to_hash(hash1) - imagehash.hex_to_hash(hash2)


def find_phash_matches(
    query_hash: str,
    index: dict[str, str],  # hash_str -> card_id
    threshold: int = 10,
) -> list[tuple[str, int]]:
    """Return (card_id, distance) pairs sorted by distance ascending."""
    matches = []
    for stored_hash, card_id in index.items():
        try:
            dist = hash_distance(query_hash, stored_hash)
            if dist <= threshold:
                matches.append((card_id, dist))
        except Exception:
            continue
    matches.sort(key=lambda x: x[1])
    return matches
