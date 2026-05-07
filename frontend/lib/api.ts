import type {
  CardDetail,
  CardSearchResponse,
  PriceHistoryResponse,
  PriceResponse,
  RecognitionResponse,
  ScanResponse,
  ScannedCard,
  TimeRange,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  searchCards(q: string, page = 1, pageSize = 20): Promise<CardSearchResponse> {
    const params = new URLSearchParams({ q, page: String(page), page_size: String(pageSize) });
    return apiFetch(`/api/v1/cards/search?${params}`);
  },

  getCard(cardId: string): Promise<CardDetail> {
    return apiFetch(`/api/v1/cards/${cardId}`);
  },

  getPrices(cardId: string, condition: string = "NM"): Promise<PriceResponse> {
    return apiFetch(`/api/v1/cards/${cardId}/prices?condition=${encodeURIComponent(condition)}`);
  },

  getPriceHistory(cardId: string, condition: string = "NM", range: TimeRange = "30d"): Promise<PriceHistoryResponse> {
    return apiFetch(`/api/v1/cards/${cardId}/history?condition=${encodeURIComponent(condition)}&range=${range}`);
  },

  identifyCard(imageFile: File): Promise<RecognitionResponse> {
    const form = new FormData();
    form.append("image", imageFile);
    return apiFetch("/api/v1/recognition/identify", { method: "POST", body: form });
  },

  scanCards(imageFile: File): Promise<ScanResponse> {
    const form = new FormData();
    form.append("image", imageFile);
    return apiFetch("/api/v1/scan", { method: "POST", body: form });
  },

  rescanCard(card: ScannedCard): Promise<ScannedCard> {
    return apiFetch("/api/v1/scan/rescan-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
  },

  searchPriceCharting(q: string, limit = 10): Promise<{
    query: string;
    results: Array<{ name: string; url: string; product_id: string | null }>;
    total: number;
  }> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return apiFetch(`/api/v1/search/pricecharting?${params}`);
  },
};
