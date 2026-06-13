/**
 * NHTSA enrichment — free, no API key. Powers the reliability-advice layer that sets this
 * app apart from a plain meta-search: recall counts per make/model/year, plus VIN decode.
 */

const RECALLS_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";
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
