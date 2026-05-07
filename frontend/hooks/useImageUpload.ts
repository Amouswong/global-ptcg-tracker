"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { RecognitionResponse } from "@/types";

export function useImageUpload() {
  const [result, setResult] = useState<RecognitionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identify = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.identifyCard(file);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Identification failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { identify, result, loading, error, reset };
}
