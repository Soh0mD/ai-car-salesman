import type { NormalizedListing, SearchPlan } from "./types";
import { getRecallCount, getComplaintStats, type ComplaintStats } from "./nhtsa";
import { checkReliability } from "./reliability";
import { search as marketcheckSearch } from "./sources/marketcheck";
import { search as ebaySearch } from "./sources/ebay";
import { search as autodevSearch } from "./sources/autodev";

/**
 * The central orchestrator. Fires every inventory source CONCURRENTLY (never sequentially —
 * that is the whole reason a high-level runtime loses nothing to C here), then normalizes,
 * dedupes, enriches the top results with NHTSA recall data, scores, and sorts.
 */

const NHTSA_CONCURRENCY = 4; // cap simultaneous recall lookups to stay polite to NHTSA
const MAX_RESULTS = 30;

/** Run async tasks with a fixed concurrency ceiling (avoids tripping API rate limits). */
async function runPooled<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export interface AggregateResult {
  listings: NormalizedListing[];
  counts: Record<string, number>; // per-source raw counts, for the UI / debugging
}

function dedupeKey(l: NormalizedListing): string {
  if (l.vin) return `vin:${l.vin.toUpperCase()}`;
  return `url:${l.listing_url}`;
}

/** Keep the cheapest instance of each duplicate VIN/URL. */
function dedupe(listings: NormalizedListing[]): NormalizedListing[] {
  const best = new Map<string, NormalizedListing>();
  for (const l of listings) {
    const key = dedupeKey(l);
    const existing = best.get(key);
    if (!existing || (l.price ?? Infinity) < (existing.price ?? Infinity)) {
      best.set(key, l);
    }
  }
  return [...best.values()];
}

function matchesExcludedBodyStyle(l: NormalizedListing, excluded: string[]): boolean {
  if (!l.body_style) return false;
  const bs = l.body_style.toLowerCase();
  return excluded.some((e) => bs.includes(e.toLowerCase()));
}

/**
 * Composite 0..100 value score: cheaper-than-budget, closer, fewer recalls, and a bump for
 * reliability-tier intent. Listings without enough data still get a reasonable baseline.
 */
function scoreListing(l: NormalizedListing, plan: SearchPlan): number {
  let score = 50;
  const budget = plan.constraints.budget_max ?? undefined;

  if (budget && l.price) {
    const ratio = l.price / budget; // <1 is under budget
    score += Math.max(-25, Math.min(25, (1 - ratio) * 50));
  }
  if (l.distance_miles != null) {
    score += Math.max(-15, 15 - l.distance_miles / 20); // closer = better
  }
  if (l.mileage != null) {
    score += Math.max(-15, 15 - l.mileage / 12000); // lower miles = better
  }
  if (l.recall_count != null) {
    score -= Math.min(20, l.recall_count * 4); // recall penalty
  }
  if (l.complaints) {
    // Gentle, capped nudge from powertrain/engine complaint volume (raw counts are
    // volume-biased, so keep this light — the curated flag handles confident calls).
    score -= Math.min(12, l.complaints.powertrain / 40);
  }
  if (l.reliability_flag) {
    // Curated known-issue penalty: "avoid" sinks hard, "caution" dents.
    score -= l.reliability_flag.severity === "avoid" ? 35 : 12;
  }
  const tier = plan.automotive_targets.mechanical_filters.reliability_tier;
  if (tier === "highest" && (l.recall_count ?? 0) === 0 && !l.reliability_flag) score += 8;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/** Run the full search-plan -> ranked-listings pipeline. */
export async function aggregate(plan: SearchPlan): Promise<AggregateResult> {
  // 1) Concurrent fan-out. allSettled so one failing/slow source never sinks the others.
  const settled = await Promise.allSettled([
    marketcheckSearch(plan),
    ebaySearch(plan),
    autodevSearch(plan),
  ]);
  const sourceNames = ["marketcheck", "ebay", "autodev"] as const;

  const counts: Record<string, number> = {};
  let merged: NormalizedListing[] = [];
  settled.forEach((r, i) => {
    const items = r.status === "fulfilled" ? r.value : [];
    counts[sourceNames[i]] = items.length;
    merged = merged.concat(items);
  });

  // 2) Dedupe across sources, then drop explicitly-excluded body styles.
  const excluded = plan.automotive_targets.excluded_body_styles;
  let listings = dedupe(merged).filter((l) => !matchesExcludedBodyStyle(l, excluded));

  // 3) Pre-rank with an un-enriched score, then keep only the result set we'll return.
  // Enriching BEFORE trimming (and only the trimmed set) is critical: recall penalties
  // re-rank listings, so every listing we might show must be enriched — otherwise an
  // un-enriched listing can float to the top with a stale, recall-free score.
  listings.forEach((l) => (l.value_score = scoreListing(l, plan)));
  listings.sort((a, b) => b.value_score - a.value_score);
  listings = listings.slice(0, MAX_RESULTS);

  // 3b) Deterministic curated reliability flags (independent of the LLM's reasoning).
  for (const l of listings) {
    l.reliability_flag = checkReliability(l.make, l.model, l.year);
  }

  // 4) Enrich with NHTSA recall counts, de-duplicated by make/model/year so identical
  // vehicles are looked up once. Concurrency-capped to stay polite to the NHTSA API.
  const comboKey = (l: NormalizedListing) => `${l.make}|${l.model}|${l.year}`;
  const uniqueCombos = new Map<string, NormalizedListing>();
  for (const l of listings) {
    if (l.make && l.model && l.year) uniqueCombos.set(comboKey(l), l);
  }
  const recallByCombo = new Map<string, number | null>();
  const complaintsByCombo = new Map<string, ComplaintStats | null>();
  await runPooled([...uniqueCombos], NHTSA_CONCURRENCY, async ([key, l]) => {
    const [recalls, complaints] = await Promise.all([
      getRecallCount(l.make!, l.model!, l.year!),
      getComplaintStats(l.make!, l.model!, l.year!),
    ]);
    recallByCombo.set(key, recalls);
    complaintsByCombo.set(key, complaints);
  });
  for (const l of listings) {
    const key = comboKey(l);
    const r = recallByCombo.get(key);
    if (r !== undefined) l.recall_count = r;
    const c = complaintsByCombo.get(key);
    if (c !== undefined) l.complaints = c;
  }

  // 5) Re-score (enriched listings now factor in recalls) and produce the final order.
  listings.forEach((l) => (l.value_score = scoreListing(l, plan)));
  listings.sort((a, b) => b.value_score - a.value_score);

  return { listings, counts };
}
