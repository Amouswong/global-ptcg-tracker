"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { RecognitionResponse, ScannedCard } from "@/types";

export type QueueItemStatus = "pending" | "processing" | "done" | "error";

export interface QueueItem {
  id: string;
  file: File;
  preview: string;
  status: QueueItemStatus;
  result: RecognitionResponse | null;
  scanFallback: ScannedCard | null;
  error: string | null;
}

export function useIdentifyQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const processingRef = useRef(false);

  const addFiles = useCallback((files: File[]) => {
    const newItems: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as QueueItemStatus,
      result: null,
      scanFallback: null,
      error: null,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item && item.status !== "processing") URL.revokeObjectURL(item.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    setItems((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.preview));
      processingRef.current = false;
      return [];
    });
  }, []);

  // Process queue one item at a time
  useEffect(() => {
    if (processingRef.current) return;
    const next = items.find((i) => i.status === "pending");
    if (!next) return;

    processingRef.current = true;

    setItems((prev) =>
      prev.map((i) => (i.id === next.id ? { ...i, status: "processing" as QueueItemStatus } : i))
    );

    api
      .identifyCard(next.file)
      .then(async (result) => {
        // If identify found nothing, fall back to the scan endpoint
        if (result.candidates.length === 0) {
          try {
            const scanRes = await api.scanCards(next.file);
            const scanFallback = scanRes.cards[0] ?? null;
            setItems((prev) =>
              prev.map((i) =>
                i.id === next.id
                  ? { ...i, status: "done" as QueueItemStatus, result, scanFallback }
                  : i
              )
            );
            return;
          } catch {
            // scan also failed — fall through and show the empty identify result
          }
        }
        setItems((prev) =>
          prev.map((i) =>
            i.id === next.id ? { ...i, status: "done" as QueueItemStatus, result } : i
          )
        );
      })
      .catch((e) => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === next.id
              ? {
                  ...i,
                  status: "error" as QueueItemStatus,
                  error: e instanceof Error ? e.message : "Identification failed",
                }
              : i
          )
        );
      })
      .finally(() => {
        processingRef.current = false;
      });
  }, [items]);

  return {
    items,
    addFiles,
    remove,
    reset,
    hasItems: items.length > 0,
    pendingCount: items.filter((i) => i.status === "pending").length,
    processingCount: items.filter((i) => i.status === "processing").length,
  };
}
