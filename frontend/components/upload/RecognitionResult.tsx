"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecognitionResponse } from "@/types";

interface Props {
  result: RecognitionResponse;
  onReset: () => void;
}

export function RecognitionResult({ result, onReset }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {result.identified ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-yellow-500" />
        )}
        <span className="font-medium">
          {result.identified ? "Card identified!" : "Multiple candidates found — please confirm"}
        </span>
        <Badge variant="outline" className="ml-auto">
          {result.candidates[0]?.match_method === "claude_vision" ? "AI Vision" : `${Math.round(result.confidence * 100)}% confidence`}
        </Badge>
      </div>

      {result.candidates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Could not identify the card. Try better lighting or use text search.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {result.candidates.map((candidate, i) => (
          <Link
            key={candidate.card.id}
            href={`/card/${candidate.card.id}`}
            className={`
              border rounded-lg p-3 flex gap-3 hover:bg-muted transition-colors
              ${i === 0 && result.identified ? "border-green-500 bg-green-500/5" : ""}
            `}
          >
            {candidate.card.image_url_small ? (
              <Image
                src={candidate.card.image_url_small}
                alt={candidate.card.name}
                width={48}
                height={67}
                className="rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-[67px] rounded bg-muted flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{candidate.card.name}</p>
              <p className="text-xs text-muted-foreground truncate">{candidate.card.set_name}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(candidate.confidence * 100)}% · {candidate.match_method}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={onReset}>
        Try another card
      </Button>
    </div>
  );
}
