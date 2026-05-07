import { notFound } from "next/navigation";
import { CardDetailView } from "@/components/card/CardDetailView";
import type { CardDetail } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function fetchCard(cardId: string): Promise<CardDetail | null> {
  try {
    const res = await fetch(`${BASE}/api/v1/cards/${cardId}`, {
      next: { revalidate: 3600 },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const card = await fetchCard(cardId);
  if (!card) return { title: "Card Not Found" };
  return {
    title: `${card.name} · ${card.set_name} — Global PTCG Tracker`,
    description: `Global market prices for ${card.name} (${card.rarity ?? ""}). Compare TCGPlayer, Cardmarket, and eBay.`,
  };
}

export default async function CardPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const card = await fetchCard(cardId);
  if (!card) notFound();
  return <CardDetailView card={card} />;
}
