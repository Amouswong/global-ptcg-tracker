"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePriceChartingSearch } from "@/hooks/usePriceChartingSearch";
import { PriceChartingSearchResults } from "./PriceChartingSearchResults";

export function SearchBar() {
  const { query, setQuery, data, loading, error } = usePriceChartingSearch();

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search cards on PriceCharting... (e.g. Pikachu)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {(query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto">
          <PriceChartingSearchResults data={data} loading={loading} error={error} />
        </div>
      )}
    </div>
  );
}
