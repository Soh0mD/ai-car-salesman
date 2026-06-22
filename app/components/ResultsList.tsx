"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { IconArrowsSort } from "@tabler/icons-react";
import type { NormalizedListing } from "@/lib/types";
import { useFavorites } from "@/lib/client-store";
import { ListingCard } from "./ListingCard";
import { CompareDrawer } from "./CompareDrawer";
import { Dropdown } from "./Dropdown";

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

  // Remember sort + filter choices across searches/sessions (localStorage). Loaded after mount
  // to avoid a hydration mismatch; saved whenever they change.
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time prefs load from localStorage on mount */
    try {
      const raw = localStorage.getItem("dascar:resultPrefs");
      if (raw) {
        const o = JSON.parse(raw) as { sort?: SortKey; filters?: FilterKey[] };
        if (o.sort && SORTS.some((s) => s.key === o.sort)) setSort(o.sort);
        if (Array.isArray(o.filters)) setFilters(new Set(o.filters));
      }
    } catch {
      /* storage unavailable — ignore */
    }
    setPrefsLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return; // don't overwrite saved prefs before we've loaded them
    try {
      localStorage.setItem("dascar:resultPrefs", JSON.stringify({ sort, filters: [...filters] }));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [sort, filters, prefsLoaded]);

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
            {view.length <= 5 && (
              <span
                className="ml-2 font-bold"
                style={{ color: view.length <= 2 ? "var(--md-tertiary)" : "var(--md-on-surface-variant)" }}
              >
                · {view.length <= 2 ? "very rare find in your area" : "rare find in your area"}
              </span>
            )}
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Dropdown
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
            ariaLabel="Sort listings"
            icon={<IconArrowsSort size={16} style={{ color: "var(--md-tertiary)" }} aria-hidden />}
            className="min-w-[190px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map((f) => {
              const on = filters.has(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFilter(f)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all"
                  style={
                    on
                      ? {
                          borderRadius: "var(--md-corner-md)",
                          background: "color-mix(in srgb, var(--md-cta) 20%, transparent)",
                          color: "var(--md-primary)",
                          border: "1px solid color-mix(in srgb, var(--md-cta) 50%, transparent)",
                        }
                      : {
                          borderRadius: "var(--md-corner-md)",
                          background: "var(--md-surface-container)",
                          color: "var(--md-on-surface-variant)",
                          border: "1px solid var(--md-outline-variant)",
                        }
                  }
                >
                  {FILTER_LABELS[f]}
                </button>
              );
            })}
          </div>
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
              className="pointer-events-auto flex items-center gap-3 rounded-full border py-2 pl-4 pr-2 shadow-2xl backdrop-blur-xl"
              style={{
                background: "color-mix(in srgb, var(--md-surface-container-high) 92%, transparent)",
                color: "var(--md-on-surface)",
                borderColor: "color-mix(in srgb, var(--md-cta) 25%, transparent)",
              }}
            >
              <span className="ml-1 text-xs font-bold uppercase tracking-wide">
                {compare.length} to compare
              </span>
              <div className="flex -space-x-3">
                {compare.slice(0, 3).map((c) => (
                  <div
                    key={idOf(c)}
                    className="h-9 w-9 overflow-hidden rounded-full"
                    style={{ border: "2px solid var(--md-surface)", background: "var(--md-surface-container)" }}
                  >
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.image_url.replace(/^http:\/\//i, "https://")}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                disabled={compare.length < 2}
                className="rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wide shadow-lg disabled:opacity-50"
                style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
              >
                Compare
              </button>
              <button
                type="button"
                onClick={() => setCompare([])}
                aria-label="Clear compare"
                className="px-1.5 text-sm opacity-70 hover:opacity-100"
              >
                ✕
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
