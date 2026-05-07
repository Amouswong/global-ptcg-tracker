import asyncio
import sys
sys.path.insert(0, ".")

from app.config import settings
settings.gemini_api_key = "AIzaSyBlP_0E-ujwce07znKh57asb_cM3DaQXkE"

from app.services.scan_service import scan_image

async def main():
    with open("/Users/amous/.claude/image-cache/96f8cd39-0b1b-4ae7-b5fa-1605d961eead/2.png", "rb") as f:
        image_bytes = f.read()
    print(f"Image: {len(image_bytes)} bytes\n")

    result = await scan_image(image_bytes, "image/png")
    print(f"total_found: {result.total_found}")
    for card in result.cards:
        print(f"\n--- {card.name_en} ---")
        print(f"  set:          {card.set_name}")
        print(f"  number:       {card.number}")
        print(f"  language:     {card.language}")
        print(f"  graded:       {card.graded} | {card.grade_company} {card.grade_value}")
        print(f"  confidence:   {card.confidence}")
        if card.prices:
            print(f"  ungraded:     ${card.prices.ungraded}")
            print(f"  psa_10:       ${card.prices.psa_10}")
            print(f"  url:          {card.prices.source_url}")
        else:
            print(f"  price_error:  {card.price_error}")

asyncio.run(main())
