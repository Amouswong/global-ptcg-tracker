"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Condition, HistoryDataPoint, TimeRange } from "@/types";

interface Props {
  cardId: string;
  condition: Condition;
  range: TimeRange;
}

const PLATFORM_COLORS = {
  composite_price: "#6366f1",
  tcgplayer_price: "#22c55e",
  cardmarket_price: "#f59e0b",
  ebay_price: "#ef4444",
};

function formatUSD(value: number) {
  return `$${value.toFixed(2)}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(dateStr: string, range: TimeRange) {
  // Parse YYYY-MM-DD without locale to avoid SSR/client mismatch
  const [, m, d] = dateStr.split("-").map(Number);
  const mon = MONTHS[m - 1];
  if (range === "3m") return mon;
  return `${mon} ${d}`;
}

export function PriceTrendChart({ cardId, condition, range }: Props) {
  const [data, setData] = useState<HistoryDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getPriceHistory(cardId, condition, range)
      .then((res) => setData(res.data_points))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cardId, condition, range]);

  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">No history available.</p>;

  const chartData = data.map((p) => ({
    ...p,
    label: formatDate(p.date, range),
  }));

  return (
    <div className="w-full h-64 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tickFormatter={formatUSD} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => typeof value === "number" ? formatUSD(value) : String(value)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="composite_price"
            stroke={PLATFORM_COLORS.composite_price}
            strokeWidth={2}
            dot={false}
            name="Composite"
          />
          <Line
            type="monotone"
            dataKey="tcgplayer_price"
            stroke={PLATFORM_COLORS.tcgplayer_price}
            strokeWidth={1.5}
            dot={false}
            name="TCGPlayer"
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="cardmarket_price"
            stroke={PLATFORM_COLORS.cardmarket_price}
            strokeWidth={1.5}
            dot={false}
            name="Cardmarket"
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="ebay_price"
            stroke={PLATFORM_COLORS.ebay_price}
            strokeWidth={1.5}
            dot={false}
            name="eBay"
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
