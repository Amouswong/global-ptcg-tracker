import Link from "next/link";
import { History } from "lucide-react";

export function Header() {
  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          Global PTCG Tracker
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground hidden sm:block">
            Real-time Pokemon TCG prices worldwide
          </span>
          <Link
            href="/history"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
