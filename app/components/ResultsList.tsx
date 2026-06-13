import type { NormalizedListing } from "@/lib/types";
import { ListingCard } from "./ListingCard";

export function ResultsList({
  listings,
  counts,
  reliabilityLoading,
}: {
  listings: NormalizedListing[];
  counts: Record<string, number> | null;
  reliabilityLoading: boolean;
}) {
  if (listings.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
          {listings.length} matches · best value first
          {reliabilityLoading && (
            <span className="ml-2 font-normal text-emerald-600 dark:text-emerald-400">
              · checking recalls &amp; complaints…
            </span>
          )}
        </span>
        {counts && (
          <span className="font-mono">
            {Object.entries(counts)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k}:${v}`)
              .join("  ")}
          </span>
        )}
      </div>
      {listings.map((l, i) => (
        <ListingCard key={`${l.listing_url}-${i}`} listing={l} />
      ))}
    </section>
  );
}
