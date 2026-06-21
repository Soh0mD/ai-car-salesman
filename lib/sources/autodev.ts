import type { NormalizedListing, SearchPlan } from "../types";

/**
 * Auto.dev Vehicle Listings API — optional cross-check / backup aggregator.
 * Free Starter plan: 1,000 calls/mo. Docs: https://docs.auto.dev/v2/products/vehicle-listings
 *
 * Verified live response shape (2026-06): records under `data[]`, each with `vehicle{}` and
 * `retailListing{}` sub-objects. Filter params are dot-notation (vehicle.make, etc.).
 * One combined query per call to respect the small free tier.
 */

const BASE = "https://api.auto.dev/listings";
const FETCH_TIMEOUT_MS = 9000;
const ROWS = 25;

interface AutoDevRecord {
  vin?: string;
  location?: [number, number];
  vehicle?: {
    make?: string;
    model?: string;
    year?: number;
    series?: string;
    style?: string;
    bodyStyle?: string;
    drivetrain?: string;
    transmission?: string;
    fuel?: string;
    cylinders?: number;
  };
  retailListing?: {
    price?: number;
    miles?: number;
    primaryImage?: string;
    vdp?: string;
    dealer?: string;
    city?: string;
    state?: string;
  } | null;
}

// Certified Pre-Owned marker (see marketcheck.ts for rationale on excluding bare "certified").
const CPO_RE = /\bcpo\b|certified pre[\s-]?owned/i;

function mapRecord(r: AutoDevRecord): NormalizedListing | null {
  const rl = r.retailListing;
  if (!rl?.vdp) return null; // skip wholesale-only / linkless records
  const v = r.vehicle ?? {};
  const title = [v.year, v.make, v.model, v.series ?? v.style].filter(Boolean).join(" ");
  return {
    source: "autodev",
    title,
    year: v.year ?? null,
    make: v.make ?? null,
    model: v.model ?? null,
    trim: v.series ?? v.style ?? null,
    price: typeof rl.price === "number" ? rl.price : null,
    mileage: typeof rl.miles === "number" ? rl.miles : null,
    vin: r.vin ?? null,
    zip: null,
    distance_miles: null,
    image_url: rl.primaryImage ?? null,
    images: rl.primaryImage ? [rl.primaryImage] : [],
    listing_url: rl.vdp,
    dealer_name: rl.dealer ?? null,
    dealer_city: rl.city ?? null,
    dealer_state: rl.state ?? null,
    drivetrain: v.drivetrain ?? null,
    transmission: v.transmission ?? null,
    fuel_type: v.fuel ?? null,
    cylinders: typeof v.cylinders === "number" ? v.cylinders : null,
    body_style: v.bodyStyle ?? null,
    recall_count: null,
    complaints: null,
    reliability_flag: null,
    deal: null,
    cpo: CPO_RE.test(`${title} ${v.series ?? ""} ${v.style ?? ""}`),
    value_score: 0,
  };
}

export async function search(plan: SearchPlan): Promise<NormalizedListing[]> {
  const apiKey = process.env.AUTODEV_API_KEY;
  if (!apiKey) return [];

  const { constraints, automotive_targets } = plan;
  const params = new URLSearchParams({ apikey: apiKey, limit: String(ROWS) });
  const first = automotive_targets.suggested_models[0];
  if (first) {
    params.set("vehicle.make", first.make);
    params.set("vehicle.model", first.model);
    params.set("vehicle.year", `${first.years.min}-${first.years.max}`);
  }
  if (constraints.budget_max) {
    params.set("retailListing.price", `1-${Math.round(constraints.budget_max)}`);
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}?${params.toString()}`, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: AutoDevRecord[] };
    return (data.data ?? []).map(mapRecord).filter((x): x is NormalizedListing => x !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
