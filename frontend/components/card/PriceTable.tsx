"use client";

import { useEffect, useState } from "react";
import { ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { GradedPrice, PriceResponse } from "@/types";

interface Props {
  cardId: string;
  condition: string;
  isJapanese?: boolean;
}

/** Adds thousands commas without any locale API (SSR-safe). */
function addCommas(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatPrice(n: number, currency: string): string {
  if (currency === "JPY") return `¥${addCommas(n)}`;
  return `$${n.toFixed(2)}`;
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return null;
  const positive = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        positive ? "text-green-600" : "text-red-500"
      }`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

const COMPANY_COLORS: Record<string, string> = {
  PSA: "bg-blue-100 text-blue-800 border-blue-200",
  CGC: "bg-purple-100 text-purple-800 border-purple-200",
  BGS: "bg-amber-100 text-amber-800 border-amber-200",
};

function GradedTable({ graded, currency }: { graded: GradedPrice[]; currency: string }) {
  // Group by company
  const companies = Array.from(new Set(graded.map((g) => g.company)));

  if (graded.length === 0) {
    return <p className="text-sm text-muted-foreground">No graded price data available.</p>;
  }

  return (
    <div className="space-y-6">
      {companies.map((company) => {
        const rows = graded.filter((g) => g.company === company).sort((a, b) => b.grade - a.grade);
        const colorClass = COMPANY_COLORS[company] || "bg-muted text-foreground";
        return (
          <div key={company}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${colorClass}`}>
                {company}
              </span>
              <span className="text-sm text-muted-foreground">Graded Prices</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-1.5 pr-3">Grade</th>
                    <th className="text-right py-1.5 pr-3">Low</th>
                    <th className="text-right py-1.5 pr-3">Market</th>
                    <th className="text-right py-1.5 pr-3">High</th>
                    <th className="text-right py-1.5 pr-3">7D</th>
                    <th className="text-right py-1.5">30D</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => (
                    <tr key={`${g.company}-${g.grade}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-semibold">
                        {g.grade % 1 === 0 ? g.grade : g.grade.toFixed(1)}
                        {g.is_perfect && (
                          <span className="ml-1 text-xs text-amber-500">✦</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                        {g.low !== null ? formatPrice(g.low, g.currency) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-semibold">
                        {g.market !== null ? formatPrice(g.market, g.currency) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                        {g.high !== null ? formatPrice(g.high, g.currency) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <TrendBadge pct={g.trend_7d} />
                      </td>
                      <td className="py-2 text-right">
                        <TrendBadge pct={g.trend_30d} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PriceTable({ cardId, condition, isJapanese }: Props) {
  const [data, setData] = useState<PriceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidPrice, setBidPrice] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getPrices(cardId, condition)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cardId, condition]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-40 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data) return null;

  const isGraded = condition.includes("-");
  const currency = data.currency;

  const bidNum = parseFloat(bidPrice);
  const profit = !isNaN(bidNum) && bidNum > 0
    ? data.composite_price - bidNum
    : null;

  return (
    <div className="space-y-6">
      {/* Composite price hero */}
      <div className="bg-muted/50 rounded-lg p-4 inline-block">
        <p className="text-sm text-muted-foreground mb-1">
          {isGraded ? `${condition} Market Price` : "Composite Price (IQR Weighted Avg)"}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{formatPrice(data.composite_price, currency)}</p>
          {isJapanese && (
            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
              JPY
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Based on {data.platforms.length} platform{data.platforms.length !== 1 ? "s" : ""} · {data.condition} condition
          {data.cached && " · cached"}
        </p>
      </div>

      {/* Bidding price + profit */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">My bid ({currency})</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={bidPrice}
            onChange={(e) => setBidPrice(e.target.value)}
            className="h-8 w-32 text-sm"
          />
        </div>
        {profit !== null && (
          <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
            profit >= 0
              ? "bg-green-500/10 text-green-700"
              : "bg-red-500/10 text-red-700"
          }`}>
            <span>Profit:</span>
            <span className="font-bold">
              {profit >= 0 ? "+" : ""}{formatPrice(profit, currency)}
            </span>
          </div>
        )}
      </div>

      {/* Graded prices table */}
      {data.graded && data.graded.length > 0 && isGraded ? (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Graded Market Prices
          </h3>
          <GradedTable graded={data.graded} currency={currency} />
        </div>
      ) : (
        /* Raw platform prices table */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4">Platform</th>
                <th className="text-right py-2 pr-4">Price</th>
                <th className="text-right py-2 pr-4">Weight</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.platforms.map((p) => (
                <tr key={p.platform} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline"
                      >
                        {p.platform}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      p.platform
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono">
                    {formatPrice(p.price, currency)}
                  </td>
                  <td className="py-3 pr-4 text-right text-muted-foreground">
                    {Math.round(p.weight * 100)}%
                  </td>
                  <td className="py-3 text-right">
                    {p.is_outlier ? (
                      <Badge variant="destructive" className="text-xs">Outlier</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Included</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Graded prices section when in raw mode — shows all grades at a glance */}
      {!isGraded && data.graded && data.graded.length > 0 && (
        <details className="group">
          <summary className="text-sm font-semibold cursor-pointer text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 select-none">
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
            Graded Card Prices (PSA / CGC / BGS)
          </summary>
          <div className="mt-3">
            <GradedTable graded={data.graded} currency={currency} />
          </div>
        </details>
      )}
    </div>
  );
}
