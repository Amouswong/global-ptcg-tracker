export type RawCondition = "NM" | "LP" | "MP";
export type GradingCompany = "PSA" | "CGC" | "BGS";
export type Grade = 10 | 9.5 | 9 | 8.5 | 8 | 7 | 6 | 5;
/** Condition can be a raw condition "NM" or graded "PSA-10", "CGC-9.5", "BGS-9" etc. */
export type Condition = RawCondition | string;
export type TimeRange = "7d" | "30d" | "3m";
export type Platform = "TCGPlayer" | "Cardmarket" | "eBay";

export interface CardSummary {
  id: string;
  name: string;
  set_name: string;
  number: string | null;
  rarity: string | null;
  image_url_small: string | null;
}

export interface CardDetail extends CardSummary {
  set_id: string;
  series: string | null;
  supertype: string | null;
  subtypes: string[] | null;
  hp: string | null;
  image_url_large: string | null;
  artist: string | null;
  release_date: string | null;
}

export interface CardSearchResponse {
  results: CardSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface PlatformPrice {
  platform: string;
  price: number;
  currency: string;
  url: string | null;
  weight: number;
  is_outlier: boolean;
  last_updated: string;
}

export interface GradedPrice {
  company: GradingCompany;
  grade: number;
  currency: string;
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  is_perfect: boolean;
  trend_7d: number | null;
  trend_30d: number | null;
}

export interface PriceResponse {
  card_id: string;
  condition: string;
  currency: string;
  composite_price: number;
  composite_method: string;
  platforms: PlatformPrice[];
  graded: GradedPrice[];
  has_japanese_price: boolean;
  cached: boolean;
  cache_expires_at: string | null;
}

export interface HistoryDataPoint {
  date: string;
  composite_price: number;
  tcgplayer_price: number | null;
  cardmarket_price: number | null;
  ebay_price: number | null;
}

export interface PriceHistoryResponse {
  card_id: string;
  condition: Condition;
  range: TimeRange;
  data_points: HistoryDataPoint[];
}

export interface RecognitionCandidate {
  card: CardSummary;
  confidence: number;
  match_method: string;
}

export interface RecognitionResponse {
  identified: boolean;
  confidence: number;
  card: CardSummary | null;
  candidates: RecognitionCandidate[];
  recognition_id: string;
}

export interface ScannedCardPrices {
  ungraded: number | null;
  grade_7: number | null;
  grade_8: number | null;
  grade_9: number | null;
  grade_9_5: number | null;
  psa_10: number | null;
  bgs_10: number | null;
  currency: string;
  ungraded_hkd: number | null;
  grade_9_hkd: number | null;
  grade_9_5_hkd: number | null;
  psa_10_hkd: number | null;
  bgs_10_hkd: number | null;
  hkd_rate: number | null;
  source_url: string | null;
  graded_price_usd: number | null;
  graded_price_hkd: number | null;
  card_image_url: string | null;
}

export interface ScannedCard {
  name: string;
  name_en: string;
  number: string | null;
  set_name: string | null;
  set_code: string | null;
  language: string;
  rarity: string | null;
  graded: boolean;
  grade_company: string | null;
  grade_value: string | null;
  is_first_edition: boolean;
  is_shadowless: boolean;
  confidence: number;
  prices: ScannedCardPrices | null;
  price_error: string | null;
  image_b64: string | null;
}

export interface ScanResponse {
  cards: ScannedCard[];
  total_found: number;
  scan_id: string;
}
