"use client";

import { useState } from "react";
import { ExternalLink, Plus, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface Props {
  data: PriceChartingResponse | null;
  loading: boolean;
  error: string | null;
}

const GRADE_OPTIONS = [
  { value: "ungraded", label: "Ungraded" },
  { value: "psa_10", label: "PSA 10" },
  { value: "psa_9", label: "PSA 9" },
  { value: "bgs_10", label: "BGS 10" },
  { value: "cgc_10", label: "CGC 10" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "jp", label: "Japanese" },
  { value: "kr", label: "Korean" },
  { value: "zh", label: "Chinese" },
];

export function PriceChartingSearchResults({ data, loading, error }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PriceChartingResult | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>("ungraded");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("jp");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!selectedCard) return;

    setSaving(true);
    try {
      // Fetch prices from PriceCharting
      const priceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/v1/search/pricecharting/prices?url=${encodeURIComponent(selectedCard.url)}`);

      let prices = null;
      if (priceResponse.ok) {
        prices = await priceResponse.json();
      }

      // Extract card info from name (format: "Card Name #Number Set Name")
      const nameParts = selectedCard.name.split('#');
      const cardName = nameParts[0].trim();
      const numberAndSet = nameParts[1] || '';
      const numberMatch = numberAndSet.match(/^(\S+)/);
      const cardNumber = numberMatch ? numberMatch[1] : null;

      // Save to scan history
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/v1/history/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_en: cardName,
          name: cardName,
          number: cardNumber,
          language: selectedLanguage,
          graded: selectedGrade !== "ungraded",
          grade_company: selectedGrade === "psa_10" || selectedGrade === "psa_9" ? "PSA" :
                         selectedGrade === "bgs_10" ? "BGS" :
                         selectedGrade === "cgc_10" ? "CGC" : null,
          grade_value: selectedGrade === "psa_10" ? "10" :
                       selectedGrade === "psa_9" ? "9" :
                       selectedGrade === "bgs_10" ? "10" :
                       selectedGrade === "cgc_10" ? "10" : null,
          confidence: 1.0,
          prices: prices,
          source_url: selectedCard.url,
        }),
      });

      if (!response.ok) throw new Error("Failed to save card");

      setDialogOpen(false);
      setSelectedCard(null);
      setSelectedGrade("ungraded");
      setSelectedLanguage("jp");

      // Show success message
      alert("Card added to scan history!");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save card");
    } finally {
      setSaving(false);
    }
  }

  function openDialog(result: PriceChartingResult) {
    setSelectedCard(result);
    setSelectedGrade("ungraded");
    setSelectedLanguage("jp");
    setDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="p-2 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error}</p>;
  }

  if (!data || data.results.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No cards found on PriceCharting.</p>;
  }

  return (
    <>
      <ul>
        {data.results.map((result, index) => (
          <li key={index} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted transition-colors group">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 flex-1 min-w-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {result.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  PriceCharting
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </a>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 h-8 w-8 p-0"
              onClick={() => openDialog(result)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {data.total > data.results.length && (
          <li className="px-3 py-2 text-xs text-center text-muted-foreground border-t">
            Showing {data.results.length} of {data.total} results
          </li>
        )}
      </ul>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Track Card Price</DialogTitle>
            <DialogDescription>
              Select the grade you want to track for this card
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{selectedCard?.name}</p>
              <p className="text-xs text-muted-foreground">PriceCharting</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Language</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Grade</label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Add to Tracking"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
