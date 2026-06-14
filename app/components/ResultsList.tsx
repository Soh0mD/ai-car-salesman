import type { NormalizedListing } from "@/lib/types";
import { ListingCard } from "./ListingCard";

export function ResultsList({
  listings,
  counts,
  reliabilityLoading,
  onSelect,
}: {
  listings: NormalizedListing[];
  counts: Record<string, number> | null;
  reliabilityLoading: boolean;
  onSelect: (listing: NormalizedListing) => void;
}) {
  if (listings.length === 0) return null;
  return (
    <section className="space-y-3">
      <div
        className="flex flex-wrap items-center justify-between gap-2 text-xs"
        style={{ color: "var(--md-on-surface-variant)" }}
      >
        <span className="font-semibold" style={{ color: "var(--md-on-surface)" }}>
          {listings.length} matches · best value first
          {reliabilityLoading && (
            <span className="ml-2 font-normal" style={{ color: "var(--md-primary)" }}>
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
        <ListingCard key={`${l.listing_url}-${i}`} listing={l} onSelect={onSelect} />
      ))}
    </section>
  );
}
