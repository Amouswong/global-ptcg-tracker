import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
      <h2 className="text-2xl font-bold">Card Not Found</h2>
      <p className="text-muted-foreground max-w-sm">
        This card ID does not exist in the database. It may have been mistyped or is not yet indexed.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 h-8 text-sm font-medium transition-colors hover:bg-primary/80"
      >
        Back to Search
      </Link>
    </div>
  );
}
