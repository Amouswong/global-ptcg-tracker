"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, ArrowLeft, Calendar, ExternalLink, Package, ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const BIDDING_PRICES_KEY = "ptcg-bidding-prices";
const BUNDLES_KEY = "ptcg-bundles";

interface HistoryItem {
  id: string;
  scan_id: string;
  name_en: string;
  name: string;
  set_name: string | null;
  set_code: string | null;
  number: string | null;
  language: string;
  rarity: string | null;
  graded: boolean;
  grade_company: string | null;
  grade_value: string | null;
  confidence: number;
  ungraded_usd: number | null;
  grade_7_usd: number | null;
  grade_8_usd: number | null;
  grade_9_usd: number | null;
  grade_9_5_usd: number | null;
  psa_10_usd: number | null;
  bgs_10_usd: number | null;
  ungraded_hkd: number | null;
  grade_7_hkd: number | null;
  grade_8_hkd: number | null;
  grade_9_hkd: number | null;
  grade_9_5_hkd: number | null;
  psa_10_hkd: number | null;
  bgs_10_hkd: number | null;
  source_url: string | null;
  sneakdunk_url: string | null;
  sneakdunk_lowest_ask_jpy: number | null;
  sneakdunk_lowest_ask_hkd: number | null;
  sneakdunk_market_price_jpy: number | null;
  sneakdunk_market_price_hkd: number | null;
  card_image_url: string | null;
  scanned_at: string | null;
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  offset: number;
  limit: number;
}

interface Bundle {
  id: string;
  name: string;
  bidHkd: number;
  itemIds: string[];
  createdAt: string;
}

interface PendingBundle {
  sourceId: string;
  targetId: string;
}

function marketPriceHkd(item: HistoryItem): number | null {
  if (item.graded && item.grade_value) {
    const g = item.grade_value;
    if (g === "10") return item.psa_10_hkd;
    if (g === "9.5") return item.grade_9_5_hkd;
    if (g === "9") return item.grade_9_hkd;
    if (g === "8") return item.grade_8_hkd;
    if (g === "7") return item.grade_7_hkd;
  }
  return item.ungraded_hkd;
}

function priceLabel(item: HistoryItem): string | null {
  const m = marketPriceHkd(item);
  return m != null ? `HK$${m.toLocaleString()}` : null;
}

// ── Draggable card tile (desktop) ────────────────────────────────────────────

function CardTile({
  item,
  onDelete,
  deleting,
  bidPrice,
  onBidChange,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
  isDragging,
  inBundle,
  allocatedCost,
}: {
  item: HistoryItem;
  onDelete: (id: string) => void;
  deleting: string | null;
  bidPrice: string;
  onBidChange: (id: string, v: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  isDragging: boolean;
  inBundle?: boolean;
  allocatedCost?: number | null;
}) {
  const gradedLabel = item.grade_company && item.grade_value
    ? `${item.grade_company} ${item.grade_value}` : null;
  const pd = priceLabel(item);
  const bid = parseFloat(bidPrice);
  const mkt = marketPriceHkd(item);
  const profit = !inBundle && !isNaN(bid) && bid > 0 && mkt != null ? mkt - bid : null;

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(item.id); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(item.id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(item.id); }}
      onDragEnd={onDragEnd}
      className={`flex flex-col border rounded-xl overflow-hidden transition-all bg-card cursor-grab active:cursor-grabbing select-none
        ${isDragging ? "opacity-40 scale-95" : ""}
        ${isDragOver ? "border-blue-500 ring-2 ring-blue-500/40 scale-[1.02]" : "hover:border-primary/50"}
      `}
    >
      <div className="flex items-center justify-between px-2 pt-1.5 pb-0">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
        {isDragOver && (
          <span className="text-[10px] text-blue-500 font-medium">Drop to bundle</span>
        )}
      </div>

      <a href={item.source_url || "#"} target="_blank" rel="noopener noreferrer"
        onClick={(e) => isDragging && e.preventDefault()}
        className="relative w-full aspect-[3/4] bg-muted hover:opacity-90 transition-opacity overflow-hidden">
        {item.card_image_url ? (
          <img src={item.card_image_url} alt={item.name_en} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
        )}
        <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          {item.language.toUpperCase()}
        </span>
        <button onClick={(e) => { e.preventDefault(); onDelete(item.id); }} disabled={deleting === item.id}
          className="absolute top-2 right-2 bg-black/60 hover:bg-destructive/80 text-white rounded p-1 transition-colors">
          {deleting === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </a>

      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="min-w-0">
          {item.source_url ? (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold hover:text-primary transition-colors inline-flex items-center gap-1 leading-tight line-clamp-2">
              {item.name_en}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <p className="text-sm font-semibold leading-tight line-clamp-2">{item.name_en}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.set_name || "Unknown Set"}{item.number ? ` · #${item.number}` : ""}
          </p>
          {(item.sneakdunk_url || item.sneakdunk_lowest_ask_hkd) && (
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] uppercase tracking-widest text-orange-500/70 font-semibold">Snkrdunk</span>
              {item.sneakdunk_lowest_ask_hkd && (
                <span className="text-xs font-bold text-orange-400">
                  HK${item.sneakdunk_lowest_ask_hkd.toLocaleString()}
                </span>
              )}
              {item.sneakdunk_url && (
                <a href={item.sneakdunk_url} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">↗</a>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-auto">
          <div className="flex-1 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex flex-col items-center justify-center py-2">
            <span className="text-[9px] uppercase tracking-widest text-yellow-600/70 font-semibold">Grade</span>
            <span className="text-sm font-black text-yellow-500 leading-tight">{gradedLabel ?? "Raw"}</span>
          </div>
          <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center py-2">
            <span className="text-[9px] uppercase tracking-widest text-emerald-600/70 font-semibold">Price</span>
            <span className="text-sm font-black text-emerald-500 leading-tight">{pd ?? "—"}</span>
          </div>
        </div>

        {inBundle && allocatedCost != null ? (
          <p className="text-[10px] text-muted-foreground text-center border-t pt-1">
            ~HK${allocatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} of bid
          </p>
        ) : (
          <div className="space-y-1.5 pt-1 border-t">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Bid HK$</span>
              <Input type="number" min="0" step="1" placeholder="0"
                value={bidPrice}
                onChange={(e) => onBidChange(item.id, e.target.value)}
                className="h-6 text-xs px-2" />
            </div>
            {profit !== null && (
              <div className={`flex justify-between text-xs font-semibold rounded px-2 py-1 ${
                profit >= 0 ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"
              }`}>
                <span>Profit</span>
                <span>{profit >= 0 ? "+" : ""}HK${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
          </div>
        )}

        {item.scanned_at && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(item.scanned_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mobile card row ──────────────────────────────────────────────────────────

function MobileCardRowWithBid({
  item,
  onDelete,
  deleting,
  bidPrice,
  onBidChange,
  bundles,
  onQuickBundle,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
}: {
  item: HistoryItem;
  onDelete: (id: string) => void;
  deleting: string | null;
  bidPrice: string;
  onBidChange: (id: string, v: string) => void;
  bundles: Bundle[];
  onQuickBundle: (itemId: string, target: "new" | string) => void;
  menuOpen: boolean;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
}) {
  const [bidOpen, setBidOpen] = useState(false);
  const gradedLabel = item.grade_company && item.grade_value
    ? `${item.grade_company} ${item.grade_value}` : null;
  const pd = priceLabel(item);
  const bid = parseFloat(bidPrice);
  const mkt = marketPriceHkd(item);
  const profit = !isNaN(bid) && bid > 0 && mkt != null ? mkt - bid : null;

  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-3 border rounded-xl p-2 transition-all bg-card hover:border-primary/40 ${bidOpen ? "rounded-b-none border-b-0" : ""}`}>
        {/* Thumbnail */}
        <div className="relative shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-muted">
          {item.card_image_url ? (
            <img src={item.card_image_url} alt={item.name_en} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground text-center px-1 leading-tight">
              No image
            </div>
          )}
          <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1 rounded">
            {item.language.toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-semibold leading-tight line-clamp-1">{item.name_en}</p>
          <p className="text-xs text-muted-foreground truncate">
            {item.set_name || "Unknown Set"}{item.number ? ` · #${item.number}` : ""}
          </p>
          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
            <span className="text-xs font-semibold text-yellow-500">{gradedLabel ?? "Raw"}</span>
            {pd && <span className="text-xs font-bold text-emerald-500">{pd}</span>}
            {item.sneakdunk_lowest_ask_hkd && (
              <span className="text-xs font-bold text-orange-400">
                SD HK${item.sneakdunk_lowest_ask_hkd.toLocaleString()}
              </span>
            )}
            {item.sneakdunk_url && (
              <a href={item.sneakdunk_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                Snkrdunk ↗
              </a>
            )}
          </div>
          {profit !== null && (
            <div className={`inline-flex text-[10px] font-semibold rounded px-1.5 py-0.5 ${
              profit >= 0 ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"
            }`}>
              {profit >= 0 ? "+" : ""}HK${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={() => onDelete(item.id)}
            disabled={deleting === item.id}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
          >
            {deleting === item.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Trash2 className="h-4 w-4" />
            }
          </button>
          <button
            onClick={() => setBidOpen(v => !v)}
            className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 hover:border-primary/50 transition-colors flex items-center gap-0.5"
          >
            Bid
            {bidOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          </button>
          {/* Bundle quick-add */}
          <div className="relative">
            <button
              onClick={() => menuOpen ? onCloseMenu() : onOpenMenu(item.id)}
              className="text-muted-foreground hover:text-blue-500 transition-colors p-1"
              title="Add to bundle"
            >
              <Package className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-30 bg-popover border rounded-lg shadow-lg min-w-[150px] py-1 text-sm">
                <button
                  onClick={() => { onQuickBundle(item.id, "new"); onCloseMenu(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors text-blue-500 font-medium"
                >
                  + New bundle
                </button>
                {bundles.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { onQuickBundle(item.id, b.id); onCloseMenu(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors truncate"
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable bid section */}
      {bidOpen && (
        <div className="border border-t-0 rounded-b-xl px-3 pb-3 pt-2 bg-card space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Bid HK$</span>
            <Input
              type="number" min="0" step="1" placeholder="0"
              value={bidPrice}
              onChange={(e) => onBidChange(item.id, e.target.value)}
              className="h-7 text-sm flex-1"
            />
          </div>
          {profit !== null && (
            <div className={`flex justify-between text-xs font-semibold rounded px-2 py-1 ${
              profit >= 0 ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"
            }`}>
              <span>Profit</span>
              <span>{profit >= 0 ? "+" : ""}HK${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bundle group ─────────────────────────────────────────────────────────────

function BundleGroup({
  bundle,
  items,
  onDelete,
  deleting,
  onDeleteBundle,
  onRemoveFromBundle,
  onDragStart,
  onDragOverBundle,
  onDropOnBundle,
  onDragEnd,
  isDragOver,
  draggingId,
  onBidChange,
  biddingPrices,
  isMobile,
  allBundles,
  onQuickBundle,
  openBundleMenuId,
  onOpenMenu,
  onCloseMenu,
}: {
  bundle: Bundle;
  items: HistoryItem[];
  onDelete: (id: string) => void;
  deleting: string | null;
  onDeleteBundle: (id: string) => void;
  onRemoveFromBundle: (bundleId: string, itemId: string) => void;
  onDragStart: (id: string) => void;
  onDragOverBundle: (bundleId: string) => void;
  onDropOnBundle: (bundleId: string) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  draggingId: string | null;
  onBidChange: (id: string, v: string) => void;
  biddingPrices: Record<string, string>;
  isMobile: boolean;
  allBundles: Bundle[];
  onQuickBundle: (itemId: string, target: "new" | string) => void;
  openBundleMenuId: string | null;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [bid, setBid] = useState(bundle.bidHkd > 0 ? String(bundle.bidHkd) : "");

  const totalMarket = items.reduce((sum, item) => {
    const m = marketPriceHkd(item);
    return m != null ? sum + m : sum;
  }, 0);
  const bidNum = parseFloat(bid);
  const profit = !isNaN(bidNum) && bidNum > 0 && totalMarket > 0 ? totalMarket - bidNum : null;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOverBundle(bundle.id); }}
      onDrop={(e) => { e.preventDefault(); onDropOnBundle(bundle.id); }}
      className={`rounded-xl border overflow-hidden transition-all ${
        isDragOver
          ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-500/10"
          : "border-blue-500/30 bg-blue-500/5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-semibold text-sm truncate">{bundle.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">{items.length} cards</span>
          {isDragOver && (
            <span className="text-xs text-blue-500 font-medium">Drop to add</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onDeleteBundle(bundle.id)}
            className="text-muted-foreground hover:text-destructive transition-colors p-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Stats + bid */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-emerald-600/70">Market</p>
            <p className="text-sm font-bold text-emerald-600">
              {totalMarket > 0 ? `HK$${totalMarket.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            </p>
          </div>
          <div className={`rounded-lg border px-3 py-1.5 text-center ${
            profit === null ? "bg-background border-border"
            : profit >= 0 ? "bg-green-500/10 border-green-500/30"
            : "bg-red-500/10 border-red-500/30"
          }`}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Profit</p>
            <p className={`text-sm font-bold ${
              profit === null ? "text-muted-foreground"
              : profit >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {profit === null ? "—"
                : `${profit >= 0 ? "+" : ""}HK$${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Bid HK$</span>
          <Input type="number" min="0" step="1" placeholder="0"
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            className="h-7 text-sm w-28" />
        </div>
      </div>

      {/* Collapsed thumbnail strip */}
      {!expanded && items.length > 0 && (
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto">
          {items.map((item) => (
            <div key={item.id} className="shrink-0 w-10 h-14 rounded-md overflow-hidden border bg-muted" title={item.name_en}>
              {item.card_image_url ? (
                <img src={item.card_image_url} alt={item.name_en} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground text-center px-0.5 leading-tight">
                  {item.name_en.slice(0, 6)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      {expanded && (
        isMobile ? (
          <div className="px-4 pb-4 flex flex-col gap-2 border-t pt-3">
            {items.map((item) => (
              <div key={item.id} className="relative">
                <MobileCardRowWithBid
                  item={item}
                  onDelete={onDelete}
                  deleting={deleting}
                  bidPrice={biddingPrices[item.id] ?? ""}
                  onBidChange={onBidChange}
                  bundles={allBundles.filter(b => b.id !== bundle.id)}
                  onQuickBundle={onQuickBundle}
                  menuOpen={openBundleMenuId === item.id}
                  onOpenMenu={onOpenMenu}
                  onCloseMenu={onCloseMenu}
                />
                <button
                  onClick={() => onRemoveFromBundle(bundle.id, item.id)}
                  title="Remove from bundle"
                  className="absolute top-2 right-2 z-10 bg-background border rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 border-t pt-3">
            {items.map((item) => {
              const m = marketPriceHkd(item);
              const allocatedCost = !isNaN(bidNum) && bidNum > 0 && totalMarket > 0 && m != null
                ? (m / totalMarket) * bidNum : null;
              return (
                <div key={item.id} className="relative">
                  <CardTile
                    item={item}
                    onDelete={onDelete}
                    deleting={deleting}
                    bidPrice={biddingPrices[item.id] ?? ""}
                    onBidChange={onBidChange}
                    onDragStart={onDragStart}
                    onDragOver={() => {}}
                    onDrop={() => {}}
                    onDragEnd={onDragEnd}
                    isDragOver={false}
                    isDragging={draggingId === item.id}
                    inBundle
                    allocatedCost={allocatedCost}
                  />
                  <button
                    onClick={() => onRemoveFromBundle(bundle.id, item.id)}
                    title="Remove from bundle"
                    className="absolute top-6 right-1 z-10 bg-background border rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ── Bundle creation dialog (desktop inline) ──────────────────────────────────

function BundlePrompt({
  sourceItem,
  targetItem,
  onConfirm,
  onCancel,
}: {
  sourceItem: HistoryItem;
  targetItem: HistoryItem;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-500 shrink-0" />
          <p className="text-sm font-semibold">Create a bundle?</p>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Group <span className="font-medium text-foreground">{sourceItem.name_en}</span> and{" "}
        <span className="font-medium text-foreground">{targetItem.name_en}</span> into a bundle.
      </p>

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          placeholder="Bundle name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onConfirm(name); if (e.key === "Escape") onCancel(); }}
          className="h-8 text-sm flex-1"
        />
        <Button size="sm" onClick={() => onConfirm(name)} className="shrink-0">
          Create
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="shrink-0">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [biddingPrices, setBiddingPrices] = useState<Record<string, string>>({});
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile bundle menu state
  const [openBundleMenuId, setOpenBundleMenuId] = useState<string | null>(null);

  // Desktop drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverBundleId, setDragOverBundleId] = useState<string | null>(null);
  const [pendingBundle, setPendingBundle] = useState<PendingBundle | null>(null);

  useEffect(() => {
    setIsMobile(
      window.matchMedia("(pointer: coarse)").matches ||
      ("ontouchstart" in window && window.innerWidth < 768)
    );
  }, []);

  useEffect(() => {
    try {
      const s = localStorage.getItem(BIDDING_PRICES_KEY);
      if (s) setBiddingPrices(JSON.parse(s));
    } catch {}
    try {
      const s = localStorage.getItem(BUNDLES_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          setBundles(parsed.map(b => ({ ...b, itemIds: Array.isArray(b.itemIds) ? b.itemIds : [] })));
        }
      }
    } catch {}
  }, []);

  function saveBundles(next: Bundle[]) {
    setBundles(next);
    try { localStorage.setItem(BUNDLES_KEY, JSON.stringify(next)); } catch {}
  }

  function setBid(id: string, value: string) {
    setBiddingPrices((prev) => {
      const next = { ...prev };
      if (value === "") delete next[id]; else next[id] = value;
      try { localStorage.setItem(BIDDING_PRICES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // ── Mobile bundle quick-add ──

  function handleQuickBundle(itemId: string, target: "new" | string) {
    if (target === "new") {
      const bundle: Bundle = {
        id: crypto.randomUUID(),
        name: `Bundle ${new Date().toLocaleDateString()}`,
        bidHkd: 0,
        itemIds: [itemId],
        createdAt: new Date().toISOString(),
      };
      const cleaned = bundles.map(b => ({
        ...b,
        itemIds: b.itemIds.filter(id => id !== itemId),
      })).filter(b => b.itemIds.length > 0);
      saveBundles([bundle, ...cleaned]);
    } else {
      const updated = bundles.map(b => {
        if (b.id === target) return { ...b, itemIds: b.itemIds.includes(itemId) ? b.itemIds : [...b.itemIds, itemId] };
        return { ...b, itemIds: b.itemIds.filter(id => id !== itemId) };
      }).filter(b => b.itemIds.length > 0);
      saveBundles(updated);
    }
  }

  // ── Desktop drag handlers ──

  function handleDragStart(id: string) {
    setDraggingId(id);
    setDragOverId(null);
    setDragOverBundleId(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
    setDragOverBundleId(null);
  }

  function handleDragOverCard(id: string) {
    if (id !== draggingId) {
      setDragOverId(id);
      setDragOverBundleId(null);
    }
  }

  function handleDragOverBundle(bundleId: string) {
    setDragOverBundleId(bundleId);
    setDragOverId(null);
  }

  function handleDropOnCard(targetId: string) {
    if (!draggingId || draggingId === targetId) { handleDragEnd(); return; }

    const sourceInBundle = bundles.find(b => b.itemIds.includes(draggingId));
    const targetInBundle = bundles.find(b => b.itemIds.includes(targetId));

    if (targetInBundle) {
      if (!targetInBundle.itemIds.includes(draggingId)) {
        const updated = bundles.map(b => {
          if (b.id === targetInBundle.id) return { ...b, itemIds: [...b.itemIds, draggingId] };
          if (sourceInBundle && b.id === sourceInBundle.id) return { ...b, itemIds: b.itemIds.filter(id => id !== draggingId) };
          return b;
        }).filter(b => b.itemIds.length > 0);
        saveBundles(updated);
      }
      handleDragEnd();
      return;
    }

    setPendingBundle({ sourceId: draggingId, targetId });
    handleDragEnd();
  }

  function handleDropOnBundle(bundleId: string) {
    if (!draggingId) { handleDragEnd(); return; }

    const bundle = bundles.find(b => b.id === bundleId);
    if (!bundle || bundle.itemIds.includes(draggingId)) { handleDragEnd(); return; }

    const updated = bundles.map(b => {
      if (b.id === bundleId) return { ...b, itemIds: [...b.itemIds, draggingId] };
      return { ...b, itemIds: b.itemIds.filter(id => id !== draggingId) };
    }).filter(b => b.itemIds.length > 0);
    saveBundles(updated);
    handleDragEnd();
  }

  function confirmBundle(name: string) {
    if (!pendingBundle) return;
    const bundle: Bundle = {
      id: crypto.randomUUID(),
      name: name.trim() || `Bundle ${new Date().toLocaleDateString()}`,
      bidHkd: 0,
      itemIds: [pendingBundle.sourceId, pendingBundle.targetId],
      createdAt: new Date().toISOString(),
    };
    const cleaned = bundles.map(b => ({
      ...b,
      itemIds: b.itemIds.filter(id => id !== pendingBundle.sourceId && id !== pendingBundle.targetId),
    })).filter(b => b.itemIds.length > 0);
    saveBundles([bundle, ...cleaned]);
    setPendingBundle(null);
  }

  function removeFromBundle(bundleId: string, itemId: string) {
    const updated = bundles.map(b =>
      b.id === bundleId ? { ...b, itemIds: b.itemIds.filter(id => id !== itemId) } : b
    ).filter(b => b.itemIds.length > 0);
    saveBundles(updated);
  }

  function deleteBundle(bundleId: string) {
    if (!confirm("Remove this bundle? Cards will stay in history.")) return;
    saveBundles(bundles.filter(b => b.id !== bundleId));
  }

  async function fetchHistory() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/history?limit=100`);
      if (!resp.ok) throw new Error("Failed to fetch history");
      setData(await resp.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this record?")) return;
    setDeleting(id);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/history/${id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error("Failed to delete");
      await fetchHistory();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => { fetchHistory(); }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchHistory}>Retry</Button>
        </div>
      </div>
    );
  }

  const allItems = data?.items || [];
  const itemById: Record<string, HistoryItem> = {};
  for (const item of allItems) itemById[item.id] = item;

  const bundledItemIds = new Set<string>();
  for (const bundle of bundles) {
    for (const id of bundle.itemIds) bundledItemIds.add(id);
  }
  const ungroupedItems = allItems.filter(item => !bundledItemIds.has(item.id));

  const pendingSource = pendingBundle ? itemById[pendingBundle.sourceId] : null;
  const pendingTarget = pendingBundle ? itemById[pendingBundle.targetId] : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <div className="space-y-1">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Scan History</h1>
        <p className="text-muted-foreground">
          {allItems.length} card{allItems.length !== 1 ? "s" : ""}
          {bundles.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-blue-400">
              <Package className="h-3 w-3" />
              {bundles.length} bundle{bundles.length !== 1 ? "s" : ""}
            </span>
          )}
        </p>
        {!isMobile && allItems.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Drag a card onto another to create a bundle, or onto an existing bundle to add it.
          </p>
        )}
        {isMobile && allItems.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Tap cards to select them, then bundle together.
          </p>
        )}
      </div>

      {allItems.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-muted-foreground">No scan history yet</p>
          <Link href="/"><Button>Scan your first card</Button></Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Desktop bundle creation prompt */}
          {!isMobile && pendingBundle && pendingSource && pendingTarget && (
            <BundlePrompt
              sourceItem={pendingSource}
              targetItem={pendingTarget}
              onConfirm={confirmBundle}
              onCancel={() => setPendingBundle(null)}
            />
          )}

          {/* Bundles */}
          {bundles.map((bundle) => {
            const bundleItems = bundle.itemIds.map(id => itemById[id]).filter(Boolean) as HistoryItem[];
            if (bundleItems.length === 0) return null;
            return (
              <BundleGroup
                key={bundle.id}
                bundle={bundle}
                items={bundleItems}
                onDelete={handleDelete}
                deleting={deleting}
                onDeleteBundle={deleteBundle}
                onRemoveFromBundle={removeFromBundle}
                onDragStart={handleDragStart}
                onDragOverBundle={handleDragOverBundle}
                onDropOnBundle={handleDropOnBundle}
                onDragEnd={handleDragEnd}
                isDragOver={dragOverBundleId === bundle.id}
                draggingId={draggingId}
                onBidChange={setBid}
                biddingPrices={biddingPrices}
                isMobile={isMobile}
                allBundles={bundles}
                onQuickBundle={handleQuickBundle}
                openBundleMenuId={openBundleMenuId}
                onOpenMenu={setOpenBundleMenuId}
                onCloseMenu={() => setOpenBundleMenuId(null)}
              />
            );
          })}

          {/* Ungrouped cards */}
          {ungroupedItems.length > 0 && (
            <div className="space-y-3">
              {bundles.length > 0 && (
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Individual cards</p>
              )}
              {isMobile ? (
                <div className="flex flex-col gap-2">
                  {ungroupedItems.map((item) => (
                    <MobileCardRowWithBid
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      deleting={deleting}
                      bidPrice={biddingPrices[item.id] ?? ""}
                      onBidChange={setBid}
                      bundles={bundles}
                      onQuickBundle={handleQuickBundle}
                      menuOpen={openBundleMenuId === item.id}
                      onOpenMenu={setOpenBundleMenuId}
                      onCloseMenu={() => setOpenBundleMenuId(null)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {ungroupedItems.map((item) => (
                    <CardTile
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      deleting={deleting}
                      bidPrice={biddingPrices[item.id] ?? ""}
                      onBidChange={setBid}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOverCard}
                      onDrop={handleDropOnCard}
                      onDragEnd={handleDragEnd}
                      isDragOver={dragOverId === item.id}
                      isDragging={draggingId === item.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
