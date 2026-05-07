"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceTable } from "./PriceTable";
import { PriceTrendChart } from "@/components/charts/PriceTrendChart";
import type { CardDetail, TimeRange, GradingCompany } from "@/types";

interface Props {
  card: CardDetail;
}

const RAW_CONDITIONS = [
  { value: "NM", label: "Near Mint" },
  { value: "LP", label: "Lightly Played" },
  { value: "MP", label: "Mod. Played" },
] as const;

const GRADING_COMPANIES: GradingCompany[] = ["PSA", "CGC", "BGS"];
const GRADE_VALUES = [10, 9.5, 9, 8.5, 8, 7, 6, 5];

export function CardDetailView({ card }: Props) {
  const isJapanese = card.id.startsWith("tcgdex-");

  // "raw" | "graded"
  const [priceMode, setPriceMode] = useState<"raw" | "graded">("raw");
  const [rawCondition, setRawCondition] = useState("NM");
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");
  const [grade, setGrade] = useState(10);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  // Derive the full condition string sent to the API
  const condition =
    priceMode === "graded" ? `${gradingCompany}-${grade}` : rawCondition;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Card hero */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-shrink-0 mx-auto sm:mx-0">
          {card.image_url_large ? (
            <Image
              src={card.image_url_large}
              alt={card.name}
              width={240}
              height={336}
              className="rounded-xl shadow-lg"
              priority
            />
          ) : (
            <div className="w-60 h-84 rounded-xl bg-muted" />
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{card.name}</h1>
              {isJapanese && (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                  Japanese
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {card.set_name}
              {card.number ? ` · #${card.number}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {card.rarity && <Badge variant="secondary">{card.rarity}</Badge>}
            {card.supertype && <Badge variant="outline">{card.supertype}</Badge>}
            {card.subtypes?.map((s) => (
              <Badge key={s} variant="outline">{s}</Badge>
            ))}
            {card.hp && <Badge variant="outline">HP {card.hp}</Badge>}
          </div>
          {card.artist && (
            <p className="text-sm text-muted-foreground">Artist: {card.artist}</p>
          )}
          {card.release_date && (
            <p className="text-sm text-muted-foreground">Released: {card.release_date}</p>
          )}
        </div>
      </div>

      {/* Prices section */}
      <div className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <h2 className="text-xl font-semibold">Global Prices</h2>

          {/* Mode switcher: Raw vs Graded */}
          <div className="flex flex-col items-end gap-2">
            <Tabs value={priceMode} onValueChange={(v) => setPriceMode(v as "raw" | "graded")}>
              <TabsList>
                <TabsTrigger value="raw">Raw Card</TabsTrigger>
                <TabsTrigger value="graded">Graded</TabsTrigger>
              </TabsList>
            </Tabs>

            {priceMode === "raw" ? (
              <Tabs value={rawCondition} onValueChange={setRawCondition}>
                <TabsList>
                  {RAW_CONDITIONS.map((c) => (
                    <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Company picker */}
                <div className="flex rounded-md border overflow-hidden text-sm">
                  {GRADING_COMPANIES.map((co) => (
                    <button
                      key={co}
                      onClick={() => setGradingCompany(co)}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        gradingCompany === co
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {co}
                    </button>
                  ))}
                </div>
                {/* Grade picker */}
                <div className="flex rounded-md border overflow-hidden text-sm">
                  {GRADE_VALUES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrade(g)}
                      className={`px-2.5 py-1.5 font-mono transition-colors ${
                        grade === g
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {g % 1 === 0 ? g : g.toFixed(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <PriceTable cardId={card.id} condition={condition} isJapanese={isJapanese} />
      </div>

      {/* Price history chart — only for raw conditions */}
      {priceMode === "raw" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Price History</h2>
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <TabsList>
                <TabsTrigger value="7d">7D</TabsTrigger>
                <TabsTrigger value="30d">30D</TabsTrigger>
                <TabsTrigger value="3m">3M</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <PriceTrendChart cardId={card.id} condition={rawCondition} range={timeRange} />
        </div>
      )}
    </div>
  );
}
