import Link from "next/link";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import type { CardSearchResponse } from "@/types";

interface Props {
  data: CardSearchResponse | null;
  loading: boolean;
  error: string | null;
}

export function SearchResults({ data, loading, error }: Props) {
  if (loading) {
    return (
      <div className="p-2 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="w-10 h-14 rounded" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
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
    return <p className="p-4 text-sm text-muted-foreground">No cards found.</p>;
  }

  return (
    <ul>
      {data.results.map((card) => (
        <li key={card.id}>
          <Link
            href={`/card/${card.id}`}
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
          >
            {card.image_url_small ? (
              <Image
                src={card.image_url_small}
                alt={card.name}
                width={40}
                height={56}
                className="rounded object-cover"
              />
            ) : (
              <div className="w-10 h-14 rounded bg-muted" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{card.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {card.set_name} {card.number ? `· #${card.number}` : ""}
                {card.rarity ? ` · ${card.rarity}` : ""}
              </p>
            </div>
          </Link>
        </li>
      ))}
      {data.total > data.results.length && (
        <li className="px-3 py-2 text-xs text-center text-muted-foreground border-t">
          {data.total} results — refine your search to narrow down
        </li>
      )}
    </ul>
  );
}
