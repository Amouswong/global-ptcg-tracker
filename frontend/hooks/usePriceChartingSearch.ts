"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface PriceChartingResult {
  name: string;
  url: string;
  product_id: string | null;
}

interface PriceChartingResponse {
  query: string;
  results: PriceChartingResult[];
  total: number;
}

export function usePriceChartingSearch(initialQuery = "") {
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<PriceChartingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.searchPriceCharting(q, 10);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  return { query, setQuery, data, loading, error };
}
