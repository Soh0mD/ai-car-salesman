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

/** True if the listing's transmission satisfies the preference (unknowns are kept). */
function transmissionMatches(t: string | null, want: "manual" | "automatic" | null | undefined): boolean {
  if (!want || !t) return true;
  const isManual = t.toLowerCase().includes("manual");
  return want === "manual" ? isManual : !isManual;
}

/**
 * True if the listing matches the fuel preference. Marketcheck tags hybrids as "Unleaded"
 * (hybrid-ness is in the model name/heading), so we detect from the name too — not just the
 * fuel_type field — otherwise every hybrid gets wrongly dropped.
 */
function fuelMatches(l: NormalizedListing, want: string | null | undefined): boolean {
  if (!want) return true;
  const name = `${l.model ?? ""} ${l.title ?? ""}`.toLowerCase();
  const f = (l.fuel_type ?? "").toLowerCase();
  const isHybrid = name.includes("hybrid") || name.includes("plug-in") || f.includes("hybrid");
  const isElectric = f.includes("electric") || name.includes("electric") || /\bev\b/.test(name);
  const isDiesel = f.includes("diesel") || name.includes("diesel") || name.includes("tdi");
  if (want === "hybrid") return isHybrid;
  if (want === "electric") return isElectric && !isHybrid; // pure EV, not a plug-in hybrid
  if (want === "diesel") return isDiesel;
  return !isElectric && !isDiesel; // gas (hybrids burn gas, so allow them through)
}

/** True if the listing's cylinder count matches the preference (0/unknown are kept). */
function cylindersMatches(c: number | null, want: number | null | undefined): boolean {
  if (!want || c == null) return true;
  return c === want;
}

/** True if the listing's drivetrain satisfies any preferred drivetrain (unknowns are kept). */
function drivetrainMatches(d: string | null, preferred: string[]): boolean {
  if (preferred.length === 0 || !d) return true;
  const dd = d.toLowerCase();
  return preferred.some((p) => {
    const pp = p.toLowerCase();
    if (pp.includes("rwd") || pp.includes("rear")) return dd.includes("rwd") || dd.includes("rear");
    if (pp.includes("fwd") || pp.includes("front")) return dd.includes("fwd") || dd.includes("front");
    if (pp.includes("awd") || pp.includes("4wd") || pp.includes("4x4") || pp.includes("all"))
      return ["awd", "4wd", "4x4", "all"].some((k) => dd.includes(k));
    return dd.includes(pp);
  });
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

/**
 * Phase A (fast): fan out to inventory sources, dedupe, apply the instant curated reliability
 * flags, score, sort, and trim to the result set. No NHTSA network calls here, so this returns
 * in ~2-3s — fast enough to show the user cards immediately (see app/api/chat/route.ts).
 */
export async function searchAndRank(plan: SearchPlan): Promise<AggregateResult> {
  // Concurrent fan-out. allSettled so one failing/slow source never sinks the others.
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

  // Dedupe across sources, then drop excluded body styles + out-of-range year/mileage.
  const excluded = plan.automotive_targets.excluded_body_styles;
  const preferredDrive = plan.automotive_targets.mechanical_filters.preferred_drivetrains;
  const { year_min, year_max, max_mileage, transmission, fuel_type, cylinders } = plan.constraints;
  let listings = dedupe(merged);
  // Sanitize implausible odometers: some feeds report fuel RANGE (e.g. 426 mi) in the mileage
  // field. A used car 4+ model years old can't realistically have under 1,000 miles, so treat
  // such values as unknown rather than display a wrong (and misleadingly low) number.
  const nowYear = new Date().getFullYear();
  for (const s of listings) {
    if (s.mileage != null && s.mileage < 1000 && s.year && nowYear - s.year >= 4) {
      s.mileage = null;
    }
  }
  listings = listings.filter((l) => {
    if (matchesExcludedBodyStyle(l, excluded)) return false;
    // Only filter when the listing actually reports the field (don't drop unknowns).
    if (year_min && l.year && l.year < year_min) return false;
    if (year_max && l.year && l.year > year_max) return false;
    if (max_mileage && l.mileage && l.mileage > max_mileage) return false;
    if (!transmissionMatches(l.transmission, transmission)) return false;
    if (!drivetrainMatches(l.drivetrain, preferredDrive)) return false;
    if (!fuelMatches(l, fuel_type)) return false;
    if (!cylindersMatches(l.cylinders, cylinders)) return false;
    return true;
  });

  // Deterministic curated reliability flags (instant, in-memory — no network).
  for (const l of listings) {
    l.reliability_flag = checkReliability(l.make, l.model, l.year);
  }

  // Score (curated flags already factored in) and trim to the set we'll return + enrich.
  listings.forEach((l) => (l.value_score = scoreListing(l, plan)));
  listings.sort((a, b) => b.value_score - a.value_score);
  listings = listings.slice(0, MAX_RESULTS);

  // Price-vs-market deal signal from in-set comparables (kept separate from value_score).
  computeDeals(listings);

  return { listings, counts };
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Label each listing's price vs comparable listings in the same result set (same make/model,
 * year ±1). Needs >=4 comparables (incl. self) to be meaningful; otherwise leaves deal null.
 * Distinct from value_score: this is purely "are you overpaying for THIS car vs the market".
 */
function computeDeals(listings: NormalizedListing[]): void {
  for (const l of listings) {
    if (l.price == null || !l.make || !l.model || l.year == null) continue;
    const comps = listings.filter(
      (o) =>
        o.price != null &&
        o.make === l.make &&
        o.model === l.model &&
        o.year != null &&
        Math.abs(o.year - l.year!) <= 1,
    );
    if (comps.length < 4) continue;
    const med = median(comps.map((o) => o.price!));
    if (med <= 0) continue;
    const ratio = l.price / med;
    const tier = ratio <= 0.93 ? "great" : ratio >= 1.07 ? "high" : "fair";
    l.deal = { tier, deltaVsMedian: Math.round(l.price - med) };
  }
}

/**
 * Phase B (slow): enrich the given listings with NHTSA recalls + complaints, then re-score
 * and re-sort. Mutates the listings in place (and returns them). Streamed as a follow-up so
 * the UI shows cards first, then fills in the reliability badges.
 */
export async function enrichListings(
  listings: NormalizedListing[],
  plan: SearchPlan,
): Promise<NormalizedListing[]> {
  // De-duplicate NHTSA lookups by make/model/year so identical vehicles are fetched once.
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

  // Re-score (enriched listings now factor in recalls/complaints) and re-sort.
  listings.forEach((l) => (l.value_score = scoreListing(l, plan)));
  listings.sort((a, b) => b.value_score - a.value_score);
  return listings;
}

/** Convenience: run both phases. Used by the smoke test; the route runs the phases separately. */
export async function aggregate(plan: SearchPlan): Promise<AggregateResult> {
  const result = await searchAndRank(plan);
  await enrichListings(result.listings, plan);
  return result;
}
