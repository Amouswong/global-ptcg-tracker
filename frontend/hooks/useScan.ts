"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { ScanResponse } from "@/types";

export type ScanStage = "idle" | "uploading" | "identifying" | "pricing" | "done";

export function useScan() {
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<ScanStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setStage("uploading");

    // Simulate stage progression while waiting for the API
    const t1 = setTimeout(() => setStage("identifying"), 1200);
    const t2 = setTimeout(() => setStage("pricing"), 6000);

    try {
      const res = await api.scanCards(file);
      setResult(res);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setStage("idle");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setStage("idle");
  }, []);

  return { scan, result, loading, stage, error, reset };
}
