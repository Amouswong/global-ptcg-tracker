"use client";

import Image from "next/image";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, Clock, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QueueItem } from "@/hooks/useIdentifyQueue";

interface Props {
  items: QueueItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

function StatusIcon({ status }: { status: QueueItem["status"] }) {
  if (status === "pending")    return <Clock className="h-4 w-4 text-muted-foreground" />;
  if (status === "processing") return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
  if (status === "done")       return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  return <AlertCircle className="h-4 w-4 text-destructive" />;
}

export function IdentifyQueue({ items, onRemove, onClear }: Props) {
  if (items.length === 0) return null;

  const doneCount = items.filter((i) => i.status === "done").length;
  const pendingCount = items.filter((i) => i.status === "pending" || i.status === "processing").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Queue — {doneCount}/{items.length} done
          {pendingCount > 0 && (
            <span className="text-muted-foreground font-normal"> · {pendingCount} remaining</span>
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 gap-1 text-muted-foreground">
          <Trash2 className="h-3.5 w-3.5" />
          Clear all
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <QueueRow key={item.id} item={item} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function QueueRow({ item, onRemove }: { item: QueueItem; onRemove: (id: string) => void }) {
  const top = item.result?.candidates[0];
  const scan = item.scanFallback;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      {/* Thumbnail */}
      <div className="relative h-14 w-10 flex-shrink-0 rounded overflow-hidden bg-muted">
        <Image src={item.preview} alt={item.file.name} fill className="object-cover" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <StatusIcon status={item.status} />
          <span className="text-sm truncate text-muted-foreground">{item.file.name}</span>
        </div>

        {item.status === "processing" && (
          <p className="text-xs text-muted-foreground">Identifying…</p>
        )}

        {item.status === "error" && (
          <p className="text-xs text-destructive">{item.error}</p>
        )}

        {item.status === "done" && (
          top ? (
            // Identify endpoint matched
            <Link
              href={`/card/${top.card.id}`}
              className="flex items-center gap-2 hover:underline"
            >
              {top.card.image_url_small && (
                <Image
                  src={top.card.image_url_small}
                  alt={top.card.name}
                  width={24}
                  height={34}
                  className="rounded object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{top.card.name}</p>
                <p className="text-xs text-muted-foreground truncate">{top.card.set_name}</p>
              </div>
              <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs">
                {top.match_method === "claude_vision"
                  ? "AI"
                  : `${Math.round(top.confidence * 100)}%`}
              </Badge>
            </Link>
          ) : scan ? (
            // Scan fallback matched
            <div className="flex items-center gap-2">
              {scan.prices?.card_image_url ? (
                <Image
                  src={scan.prices.card_image_url}
                  alt={scan.name_en}
                  width={24}
                  height={34}
                  className="rounded object-cover flex-shrink-0"
                />
              ) : scan.image_b64 ? (
                <Image
                  src={`data:image/jpeg;base64,${scan.image_b64}`}
                  alt={scan.name_en}
                  width={24}
                  height={34}
                  className="rounded object-cover flex-shrink-0"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{scan.name_en}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {scan.set_name}
                  {scan.graded && scan.grade_company && scan.grade_value
                    ? ` · ${scan.grade_company} ${scan.grade_value}`
                    : ""}
                </p>
                {scan.prices?.ungraded_hkd != null && (
                  <p className="text-xs text-muted-foreground">
                    HK${scan.prices.ungraded_hkd.toFixed(1)} ungraded
                  </p>
                )}
              </div>
              <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs">
                {Math.round(scan.confidence * 100)}%
              </Badge>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Could not identify card</p>
          )
        )}
      </div>

      {/* Remove button — only when not actively processing */}
      {item.status !== "processing" && (
        <button
          onClick={() => onRemove(item.id)}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
