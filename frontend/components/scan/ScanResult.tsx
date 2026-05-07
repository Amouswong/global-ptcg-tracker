"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, ExternalLink, RotateCcw, RefreshCw, Loader2, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { ScanResponse, ScannedCard } from "@/types";

const BUNDLES_KEY = "ptcg-bundles";

interface Bundle {
  id: string;
  name: string;
  bidHkd: number;
  cardIds: string[]; // scan_id based — used for history linkage
  createdAt: string;
}

interface Props {
  result: ScanResponse;
  onReset: () => void;
}

function fmt(hkd: number | null, usd: number | null) {
  if (hkd != null) return `HK$${hkd.toLocaleString()}`;
  if (usd != null) return `US$${usd.toFixed(2)}`;
  return null;
}

function getMarketHkd(card: ScannedCard): number | null {
  const p = card.prices;
  if (!p) return null;
  const gradedLabel = card.grade_company && card.grade_value;
  if (gradedLabel && p.graded_price_hkd != null) return p.graded_price_hkd;
  if (p.ungraded_hkd != null) return p.ungraded_hkd;
  return null;
}

function CardItem({ card, onRescan, bidPrice, onBidChange }: {
  card: ScannedCard;
  onRescan: (updated: ScannedCard) => void;
  bidPrice?: string;
  onBidChange?: (v: string) => void;
}) {
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

  async function handleRescan() {
    setRescanning(true);
    setRescanError(null);
    try {
      const updated = await api.rescanCard(card);
      onRescan(updated);
    } catch (e) {
      setRescanError(e instanceof Error ? e.message : "Rescan failed");
    } finally {
      setRescanning(false);
    }
  }

  const p = card.prices;
  const gradedLabel = card.grade_company && card.grade_value
    ? `${card.grade_company} ${card.grade_value}`
    : null;
  const marketPriceHkd = getMarketHkd(card);

  const bidNum = bidPrice !== undefined ? parseFloat(bidPrice) : NaN;
  const profit = !isNaN(bidNum) && bidNum > 0 && marketPriceHkd != null
    ? marketPriceHkd - bidNum
    : null;

  return (
    <div className="h-full flex flex-col border rounded-xl overflow-hidden bg-card">
      {(card.prices?.card_image_url || card.image_b64) && (
        <div className="w-full bg-muted flex items-center justify-center" style={{ maxHeight: 220 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.prices?.card_image_url ?? `data:image/jpeg;base64,${card.image_b64}`}
            alt={card.name_en}
            className="object-contain w-full"
            style={{ maxHeight: 220 }}
          />
        </div>
      )}

      <div className="flex flex-col flex-1 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{card.name_en}</p>
            {card.name !== card.name_en && (
              <p className="text-xs text-muted-foreground truncate">{card.name}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {card.set_name}{card.number ? ` · #${card.number}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className="text-xs">{card.language.toUpperCase()}</Badge>
            {gradedLabel && (
              <Badge className="text-xs bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                {gradedLabel}
              </Badge>
            )}
            {card.rarity && (
              <Badge variant="secondary" className="text-xs">{card.rarity}</Badge>
            )}
          </div>
        </div>

        <div className="flex-1">
          {p ? (
            <div className="space-y-2 border-t pt-3">
              {gradedLabel && p.graded_price_hkd != null && (
                <div className="flex justify-between items-center bg-yellow-500/10 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium">{gradedLabel} value</span>
                  <div className="text-right">
                    <p className="text-base font-bold">HK${p.graded_price_hkd.toLocaleString()}</p>
                    {p.graded_price_usd != null && (
                      <p className="text-xs text-muted-foreground">US${p.graded_price_usd.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              )}
              {fmt(p.ungraded_hkd, p.ungraded) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ungraded</span>
                  <div className="text-right">
                    <span className="font-medium">{fmt(p.ungraded_hkd, p.ungraded)}</span>
                    {p.ungraded_hkd != null && p.ungraded != null && (
                      <p className="text-xs text-muted-foreground">US${p.ungraded.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              )}
              {[
                { label: "PSA 9",   hkd: p.grade_9_hkd,   usd: p.grade_9   },
                { label: "PSA 9.5", hkd: p.grade_9_5_hkd, usd: p.grade_9_5 },
                { label: "PSA 10",  hkd: p.psa_10_hkd,    usd: p.psa_10    },
                { label: "BGS 10",  hkd: p.bgs_10_hkd,    usd: p.bgs_10    },
              ]
                .filter(r => r.usd != null)
                .map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <div className="text-right">
                      <span className="font-medium">{fmt(row.hkd, row.usd)}</span>
                      {row.hkd != null && row.usd != null && (
                        <p className="text-xs text-muted-foreground">US${row.usd.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              {p.source_url && (
                <a href={p.source_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
                  PriceCharting <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {p.hkd_rate && (
                <p className="text-xs text-muted-foreground">Rate: 1 USD = {p.hkd_rate} HKD</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground border-t pt-3">{card.price_error}</p>
          )}
        </div>

        {/* Individual bid — only shown when NOT in bundle mode */}
        {onBidChange !== undefined && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Bid (HK$)</label>
              <Input
                type="number" min="0" step="1" placeholder="0"
                value={bidPrice ?? ""}
                onChange={(e) => onBidChange(e.target.value)}
                className="h-7 text-sm"
              />
            </div>
            {profit !== null && (
              <div className={`flex justify-between items-center rounded-md px-3 py-1.5 text-sm font-medium ${
                profit >= 0 ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"
              }`}>
                <span>Profit</span>
                <span className="font-bold">
                  {profit >= 0 ? "+" : ""}HK${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">{Math.round(card.confidence * 100)}% confidence</p>
          <button onClick={handleRescan} disabled={rescanning}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            {rescanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {rescanning ? "Refreshing…" : "Refresh price"}
          </button>
        </div>
        {rescanError && <p className="text-xs text-destructive">{rescanError}</p>}
      </div>
    </div>
  );
}

export function ScanResult({ result, onReset }: Props) {
  const [cards, setCards] = useState<ScannedCard[]>(result.cards);
  const [bundleMode, setBundleMode] = useState<"ask" | "yes" | "no">(
    result.cards.length > 1 ? "ask" : "no"
  );
  const [bundleName, setBundleName] = useState("");
  const [bundleBid, setBundleBid] = useState("");
  const [bundleSaved, setBundleSaved] = useState(false);
  const [cardBids, setCardBids] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState(true);

  const total = cards.length;

  function handleRescan(index: number, updated: ScannedCard) {
    setCards(prev => prev.map((c, i) => i === index ? updated : c));
  }

  function setCardBid(index: number, value: string) {
    setCardBids(prev => ({ ...prev, [index]: value }));
  }

  // Bundle totals
  const totalMarketHkd = cards.reduce((sum, c) => {
    const m = getMarketHkd(c);
    return m != null ? sum + m : sum;
  }, 0);
  const bundleBidNum = parseFloat(bundleBid);
  const bundleProfit = !isNaN(bundleBidNum) && bundleBidNum > 0 && totalMarketHkd > 0
    ? totalMarketHkd - bundleBidNum
    : null;

  function saveBundle() {
    if (!bundleBid) return;
    const bundle: Bundle = {
      id: crypto.randomUUID(),
      name: bundleName.trim() || `Bundle ${new Date().toLocaleDateString()}`,
      bidHkd: bundleBidNum,
      cardIds: [result.scan_id],
      createdAt: new Date().toISOString(),
    };
    try {
      const stored = localStorage.getItem(BUNDLES_KEY);
      const existing: Bundle[] = stored ? JSON.parse(stored) : [];
      localStorage.setItem(BUNDLES_KEY, JSON.stringify([bundle, ...existing]));
    } catch {}
    setBundleSaved(true);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {total > 0 ? (
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
          )}
          <span className="font-medium">
            {total > 0 ? `${total} card${total > 1 ? "s" : ""} found` : "No cards detected"}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>

      {total === 0 && (
        <p className="text-sm text-muted-foreground">Try better lighting or a clearer angle.</p>
      )}

      {/* Bundle prompt — shown when multiple cards scanned */}
      {total > 1 && bundleMode === "ask" && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <p className="text-sm font-medium">Is this a bundle purchase?</p>
          </div>
          <p className="text-xs text-muted-foreground">
            You scanned {total} cards. If you bought them together at one price, track them as a bundle to see total profit.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setBundleMode("yes")} className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Yes, it&apos;s a bundle
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBundleMode("no")}>
              No, price individually
            </Button>
          </div>
        </div>
      )}

      {/* Bundle mode UI */}
      {bundleMode === "yes" && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
          {/* Bundle header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <Input
                placeholder="Bundle name (optional)"
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                className="h-7 text-sm w-48 bg-background"
              />
            </div>
            <button onClick={() => setExpanded(v => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-background border px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Cards</p>
              <p className="text-lg font-bold">{total}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-emerald-600/70">Market</p>
              <p className="text-lg font-bold text-emerald-600">
                {totalMarketHkd > 0 ? `HK$${totalMarketHkd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
              </p>
            </div>
            <div className={`rounded-lg border px-3 py-2 ${
              bundleProfit === null ? "bg-background border-border"
              : bundleProfit >= 0 ? "bg-green-500/10 border-green-500/30"
              : "bg-red-500/10 border-red-500/30"
            }`}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Profit</p>
              <p className={`text-lg font-bold ${
                bundleProfit === null ? "text-muted-foreground"
                : bundleProfit >= 0 ? "text-green-600"
                : "text-red-600"
              }`}>
                {bundleProfit === null ? "—"
                  : `${bundleProfit >= 0 ? "+" : ""}HK$${bundleProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </p>
            </div>
          </div>

          {/* Bundle bid input */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Total bid (HK$)</label>
              <Input
                type="number" min="0" step="1" placeholder="0"
                value={bundleBid}
                onChange={(e) => setBundleBid(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            {!bundleSaved ? (
              <Button size="sm" onClick={saveBundle} disabled={!bundleBid} className="shrink-0">
                Save bundle
              </Button>
            ) : (
              <span className="text-xs text-green-600 font-medium shrink-0">Saved ✓</span>
            )}
          </div>

          {/* Per-card breakdown */}
          {expanded && (
            <div className="space-y-1 border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">Per-card market value</p>
              {cards.map((card, i) => {
                const m = getMarketHkd(card);
                const share = !isNaN(bundleBidNum) && bundleBidNum > 0 && totalMarketHkd > 0 && m != null
                  ? (m / totalMarketHkd) * bundleBidNum
                  : null;
                return (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <span className="truncate max-w-[140px] text-muted-foreground">{card.name_en}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {share != null && (
                        <span className="text-muted-foreground">cost ~HK${share.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      )}
                      <span className="font-semibold">
                        {m != null ? `HK$${m.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => setBundleMode("no")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Switch to individual pricing →
          </button>
        </div>
      )}

      {/* Card grid */}
      {total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, index) => (
            <CardItem
              key={index}
              card={card}
              onRescan={(updated) => handleRescan(index, updated)}
              // hide individual bid inputs in bundle mode
              bidPrice={bundleMode === "yes" ? undefined : (cardBids[index] ?? "")}
              onBidChange={bundleMode === "yes" ? undefined : (v) => setCardBid(index, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
