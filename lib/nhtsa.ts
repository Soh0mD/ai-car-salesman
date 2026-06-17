/**
 * NHTSA enrichment — free, no API key. Powers the reliability-advice layer that sets this
 * app apart from a plain meta-search: recall counts per make/model/year, plus VIN decode.
 */

const RECALLS_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";
const COMPLAINTS_BASE = "https://api.nhtsa.gov/complaints/complaintsByVehicle";
const SAFETY_BASE = "https://api.nhtsa.gov/SafetyRatings";
const VPIC_DECODE = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

// NHTSA is occasionally slow on a cold combo. Recall data is best-effort enrichment, so
// fail fast (no badge) rather than let one hung lookup dominate request latency. Results
// are cached per make/model/year, so the cache warms up across requests.
const FETCH_TIMEOUT_MS = 4500;

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    // no-store: bypass Next.js's fetch data-cache wrapper (we cache at the app layer).
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// In-process memo so we never hit NHTSA twice for the same make/model/year in a session.
const recallCache = new Map<string, number>();

/** Number of open recalls for a given make/model/year (null if unknown / lookup failed). */
export async function getRecallCount(
  make: string,
  model: string,
  year: number,
): Promise<number | null> {
  const key = `${make}|${model}|${year}`.toLowerCase();
  const cached = recallCache.get(key);
  if (cached !== undefined) return cached;

  const url = `${RECALLS_BASE}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(
    model,
  )}&modelYear=${year}`;
  const data = (await getJson(url)) as { Count?: number; results?: unknown[] } | null;
  if (!data) return null;

  const count =
    typeof data.Count === "number"
      ? data.Count
      : Array.isArray(data.results)
        ? data.results.length
        : 0;
  recallCache.set(key, count);
  return count;
}

export interface ComplaintStats {
  total: number;
  /** Complaints whose component touches the drivetrain — the chronic-reliability signal. */
  powertrain: number;
}

// Complaint payloads can be large (thousands of records), so allow a little more time.
const COMPLAINTS_TIMEOUT_MS = 7000;
const complaintsCache = new Map<string, ComplaintStats | null>();

interface ComplaintRecord {
  components?: string;
}

/**
 * Consumer-complaint volume for a make/model/year, with the powertrain/engine subset broken
 * out. Dynamic and available for every consumer vehicle (no curation). Note: raw counts are
 * volume-biased by sales, so treat as a signal, not a verdict — see lib/reliability.ts for the
 * curated precision layer that catches known-bad designs the raw numbers bury.
 */
export async function getComplaintStats(
  make: string,
  model: string,
  year: number,
): Promise<ComplaintStats | null> {
  const key = `${make}|${model}|${year}`.toLowerCase();
  const cached = complaintsCache.get(key);
  if (cached !== undefined) return cached;

  const url = `${COMPLAINTS_BASE}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(
    model,
  )}&modelYear=${year}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), COMPLAINTS_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { Count?: number; results?: ComplaintRecord[] };
    const results = data.results ?? [];
    let powertrain = 0;
    for (const r of results) {
      const c = r.components?.toUpperCase() ?? "";
      if (c.includes("POWER TRAIN") || c.includes("ENGINE")) powertrain++;
    }
    const stats: ComplaintStats = {
      total: typeof data.Count === "number" ? data.Count : results.length,
      powertrain,
    };
    complaintsCache.set(key, stats);
    return stats;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface SafetyRating {
  overall: number | null;
  frontal: number | null;
  side: number | null;
  rollover: number | null;
}

const safetyCache = new Map<string, SafetyRating | null>();

/** NHTSA NCAP 5-star crash ratings for a make/model/year (2-step lookup). Null if unrated. */
export async function getSafetyRating(
  make: string,
  model: string,
  year: number,
): Promise<SafetyRating | null> {
  const key = `${make}|${model}|${year}`.toLowerCase();
  const cached = safetyCache.get(key);
  if (cached !== undefined) return cached;

  const lookup = (await getJson(
    `${SAFETY_BASE}/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`,
  )) as { Results?: { VehicleId?: number }[] } | null;
  const vehicleId = lookup?.Results?.[0]?.VehicleId;
  if (!vehicleId) {
    safetyCache.set(key, null);
    return null;
  }

  const data = (await getJson(`${SAFETY_BASE}/VehicleId/${vehicleId}`)) as {
    Results?: {
      OverallRating?: string;
      OverallFrontCrashRating?: string;
      OverallSideCrashRating?: string;
      RolloverRating?: string;
    }[];
  } | null;
  const r = data?.Results?.[0];
  const star = (v: string | undefined) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) ? n : null;
  };
  const result: SafetyRating = {
    overall: star(r?.OverallRating),
    frontal: star(r?.OverallFrontCrashRating),
    side: star(r?.OverallSideCrashRating),
    rollover: star(r?.RolloverRating),
  };
  safetyCache.set(key, result);
  return result;
}

export interface VinFacts {
  make: string | null;
  model: string | null;
  year: number | null;
  bodyClass: string | null;
  drivetrain: string | null;
  seats: number | null;
}

/** Decode a VIN to canonical specs (used to backfill listings missing structured fields). */
export async function decodeVin(vin: string): Promise<VinFacts | null> {
  const url = `${VPIC_DECODE}/${encodeURIComponent(vin)}?format=json`;
  const data = (await getJson(url)) as { Results?: Record<string, string>[] } | null;
  const r = data?.Results?.[0];
  if (!r) return null;

  const num = (v: string | undefined) => {
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  return {
    make: r.Make || null,
    model: r.Model || null,
    year: num(r.ModelYear),
    bodyClass: r.BodyClass || null,
    drivetrain: r.DriveType || null,
    seats: num(r.Seats),
  };
}
