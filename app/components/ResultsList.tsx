"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { NormalizedListing } from "@/lib/types";
import { useFavorites } from "@/lib/client-store";
import { ListingCard } from "./ListingCard";
import { CompareDrawer } from "./CompareDrawer";

type SortKey = "best" | "deal" | "price-low" | "price-high" | "miles-low" | "year-new" | "distance";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "best", label: "Best match" },
  { key: "deal", label: "Best deal" },
  { key: "price-low", label: "Price ↑" },
  { key: "price-high", label: "Price ↓" },
  { key: "miles-low", label: "Fewest miles" },
  { key: "year-new", label: "Newest" },
  { key: "distance", label: "Closest" },
];

const last = Number.MAX_SAFE_INTEGER;

function sortListings(list: NormalizedListing[], key: SortKey): NormalizedListing[] {
  const by = [...list];
  switch (key) {
    case "deal":
      return by.sort((a, b) => (a.deal?.deltaVsMedian ?? last) - (b.deal?.deltaVsMedian ?? last));
    case "price-low":
      return by.sort((a, b) => (a.price ?? last) - (b.price ?? last));
    case "price-high":
      return by.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    case "miles-low":
      return by.sort((a, b) => (a.mileage ?? last) - (b.mileage ?? last));
    case "year-new":
      return by.sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
    case "distance":
      return by.sort((a, b) => (a.distance_miles ?? last) - (b.distance_miles ?? last));
    default:
      return by.sort((a, b) => b.value_score - a.value_score);
  }
}

type FilterKey = "deals" | "clean" | "saved";

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
  const { isFavorite, toggleFavorite } = useFavorites();
  const [sort, setSort] = useState<SortKey>("best");
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [compare, setCompare] = useState<NormalizedListing[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const idOf = (l: NormalizedListing) => l.vin ?? l.listing_url;
  const toggleCompare = (l: NormalizedListing) =>
    setCompare((c) =>
      c.some((x) => idOf(x) === idOf(l)) ? c.filter((x) => idOf(x) !== idOf(l)) : c.length >= 4 ? c : [...c, l],
    );

  const toggleFilter = (f: FilterKey) =>
    setFilters((s) => {
      const next = new Set(s);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const view = useMemo(() => {
    let v = listings;
    if (filters.has("deals")) v = v.filter((l) => l.deal?.tier === "great");
    if (filters.has("clean"))
      v = v.filter((l) => !l.reliability_flag && (l.recall_count == null || l.recall_count === 0));
    if (filters.has("saved")) v = v.filter(isFavorite);
    return sortListings(v, sort);
  }, [listings, filters, sort, isFavorite]);

  if (listings.length === 0) return null;

  const FILTER_LABELS: Record<FilterKey, string> = {
    deals: "💰 Great deals",
    clean: "✅ No known issues",
    saved: "♥ Saved",
  };

  return (
    <section className="space-y-3">
      {/* controls */}
      <div className="space-y-2">
        <div
          className="flex flex-wrap items-center justify-between gap-2 text-xs"
          style={{ color: "var(--md-on-surface-variant)" }}
        >
          <span className="font-semibold" style={{ color: "var(--md-on-surface)" }}>
            {view.length} {view.length === listings.length ? "matches" : `of ${listings.length}`}
            {reliabilityLoading && (
              <span className="ml-2 font-normal" style={{ color: "var(--md-primary)" }}>
                · checking recalls &amp; complaints…
              </span>
            )}
          </span>
          {counts && (
            <span className="font-mono">
              {Object.entries(counts)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => `${k}:${n}`)
                .join("  ")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--md-on-surface-variant)" }}>
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="md-field px-2 py-1 text-xs font-semibold"
            style={{ color: "var(--md-on-surface)" }}
            aria-label="Sort listings"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => toggleFilter(f)}
              className="md-chip"
              data-selected={filters.has(f)}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {view.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
          No cars match those filters — clear one to see more.
        </p>
      ) : (
        view.map((l, i) => (
          <ListingCard
            key={`${l.listing_url}-${i}`}
            listing={l}
            onSelect={onSelect}
            isFavorite={isFavorite(l)}
            onToggleFavorite={toggleFavorite}
            comparing={compare.some((x) => idOf(x) === idOf(l))}
            onToggleCompare={toggleCompare}
            compareDisabled={compare.length >= 4}
          />
        ))
      )}

      {/* floating compare bar */}
      <AnimatePresence>
        {compare.length > 0 && (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
            <div
              className="pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 shadow-lg"
              style={{ background: "var(--md-inverse-surface)", color: "var(--md-inverse-on-surface)" }}
            >
              <span className="text-sm font-semibold">{compare.length} to compare</span>
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                disabled={compare.length < 2}
                className="md-btn md-btn-filled !px-4 !py-1.5 !text-sm"
              >
                Compare
              </button>
              <button
                type="button"
                onClick={() => setCompare([])}
                aria-label="Clear compare"
                className="text-sm opacity-70 hover:opacity-100"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        {showCompare && (
          <CompareDrawer
            listings={compare}
            onClose={() => setShowCompare(false)}
            onRemove={(l) => toggleCompare(l)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
