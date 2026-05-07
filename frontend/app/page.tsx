"use client";

import { useState, useEffect } from "react";
import { useIdentifyQueue } from "@/hooks/useIdentifyQueue";
import { useScan } from "@/hooks/useScan";
import { SearchBar } from "@/components/search/SearchBar";
import { ImageUploadZone } from "@/components/upload/ImageUploadZone";
import { CameraCapture } from "@/components/upload/CameraCapture";
import { IdentifyQueue } from "@/components/upload/IdentifyQueue";
import { ScanResult } from "@/components/scan/ScanResult";
import { ScanLine, DollarSign, Upload, CheckCircle2 } from "lucide-react";
import type { ScanStage } from "@/hooks/useScan";

function ScanProgressBar({ stage }: { stage: ScanStage }) {
  const steps: { key: ScanStage; label: string; icon: React.ReactNode }[] = [
    { key: "uploading",   label: "Uploading",   icon: <Upload className="h-3.5 w-3.5" /> },
    { key: "identifying", label: "Identifying", icon: <ScanLine className="h-3.5 w-3.5" /> },
    { key: "pricing",     label: "Pricing",     icon: <DollarSign className="h-3.5 w-3.5" /> },
  ];
  const order: ScanStage[] = ["idle", "uploading", "identifying", "pricing", "done"];
  const currentIdx = order.indexOf(stage);

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-start justify-between gap-2">
        {steps.map((s, i) => {
          const stepOrder = order.indexOf(s.key);
          const done   = currentIdx > stepOrder;
          const active = currentIdx === stepOrder;
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                done   ? "border-green-500 bg-green-500/10 text-green-600"
                : active ? "border-primary bg-primary/10 text-primary"
                : "border-muted text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : s.icon}
              </div>
              <span className={`text-xs text-center leading-tight ${
                active ? "text-foreground font-medium" : "text-muted-foreground"
              }`}>{s.label}</span>
            </div>
          );
        })}
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${Math.max(5, Math.min(95, ((currentIdx - 1) / steps.length) * 100))}%` }}
        />
      </div>
      <p className="text-center text-sm text-muted-foreground animate-pulse">
        {stage === "uploading"   && "Uploading photo…"}
        {stage === "identifying" && "AI is identifying cards…"}
        {stage === "pricing"     && "Fetching prices…"}
      </p>
    </div>
  );
}

type Mode = "identify" | "scan";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("scan");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const queue = useIdentifyQueue();
  const { scan, result: scanResult, loading: scanLoading, stage: scanStage, error: scanError, reset: scanReset } = useScan();

  function handleReset() {
    queue.reset();
    scanReset();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Global PTCG Tracker</h1>
        <p className="text-muted-foreground">
          Instant price comparison across TCGPlayer, Cardmarket &amp; eBay — worldwide.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Search by name</p>
        <SearchBar />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or identify by photo</span>
        </div>
      </div>

      {mounted && (
        <div className="space-y-4">
          <div className="flex rounded-lg border p-1 gap-1">
            <button
              onClick={() => { handleReset(); setMode("scan"); }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "scan" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Scan multiple cards
            </button>
            <button
              onClick={() => { handleReset(); setMode("identify"); }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "identify" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Identify single card
            </button>
          </div>

          {/* Scan mode */}
          {mode === "scan" && (
            <>
              {scanLoading && <ScanProgressBar stage={scanStage} />}
              {scanError && !scanLoading && (
                <div className="text-sm text-destructive text-center py-2">{scanError}</div>
              )}
              {scanResult && !scanLoading ? (
                <ScanResult result={scanResult} onReset={handleReset} />
              ) : (
                !scanLoading && (
                  <>
                    <ImageUploadZone onFile={scan} disabled={scanLoading} />
                    <CameraCapture onCapture={scan} />
                  </>
                )
              )}
            </>
          )}

          {/* Identify mode — queue-based, upload zone always visible */}
          {mode === "identify" && (
            <>
              <ImageUploadZone onFile={(f) => queue.addFiles([f])} multiple disabled={false} />
              <CameraCapture onCapture={(f) => queue.addFiles([f])} />
              <IdentifyQueue
                items={queue.items}
                onRemove={queue.remove}
                onClear={queue.reset}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
