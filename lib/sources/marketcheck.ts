import type { NormalizedListing, SearchPlan } from "../types";

/**
 * Marketcheck — the dealer-inventory backbone (aggregates the big dealer sites).
 * Free/Starter tier is only ~500 queries/MONTH (quota headers confirm), and each user search can
 * fan out to several calls — so cache aggressively and keep the fan-out small. Docs: https://docs.marketcheck.com
 *
 * Field mappings follow the v2 /search/car/active response shape. If a future API
 * revision renames fields, this mapper degrades gracefully (optional chaining + nulls)
 * rather than throwing — sanity-check once with scripts/test-source.ts after adding a key.
 */

const BASE = "https://mc-api.marketcheck.com/v2/search/car/active";
const FETCH_TIMEOUT_MS = 9000;
const MAX_MODELS = 4; // cap parallel sub-queries to stay polite to the free tier
const ROWS_PER_MODEL = 15;
const MC_MAX_RADIUS = 100; // the subscribed plan rejects radius > 100 mi with HTTP 422

interface MCListing {
  id?: string;
  vin?: string;
  heading?: string;
  price?: number;
  miles?: number;
  vdp_url?: string;
  dist?: number;
  dealer?: { name?: string; city?: string; state?: string };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    drivetrain?: string;
    transmission?: string;
    fuel_type?: string;
    cylinders?: number;
    body_type?: string;
  };
  media?: { photo_links?: string[] };
}

async function getJson(url: string): Promise<{ listings?: MCListing[] } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as { listings?: MCListing[] };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function mapListing(l: MCListing): NormalizedListing | null {
  if (!l.vdp_url) return null;
  const title = l.heading ?? [l.build?.year, l.build?.make, l.build?.model].filter(Boolean).join(" ");
  return {
    source: "marketcheck",
    title,
    year: l.build?.year ?? null,
    make: l.build?.make ?? null,
    model: l.build?.model ?? null,
    trim: l.build?.trim ?? null,
    price: typeof l.price === "number" ? l.price : null,
    mileage: typeof l.miles === "number" ? l.miles : null,
    vin: l.vin ?? null,
    zip: null,
    distance_miles: typeof l.dist === "number" ? Math.round(l.dist) : null,
    image_url: l.media?.photo_links?.[0] ?? null,
    images: l.media?.photo_links ?? [],
    listing_url: l.vdp_url,
    dealer_name: l.dealer?.name ?? null,
    dealer_city: l.dealer?.city ?? null,
    dealer_state: l.dealer?.state ?? null,
    drivetrain: l.build?.drivetrain ?? null,
    transmission: l.build?.transmission ?? null,
    fuel_type: l.build?.fuel_type ?? null,
    cylinders: typeof l.build?.cylinders === "number" ? l.build.cylinders : null,
    body_style: l.build?.body_type ?? null,
    recall_count: null,
    complaints: null,
    reliability_flag: null,
    deal: null,
    cpo: CPO_RE.test(`${title} ${l.build?.trim ?? ""}`),
    value_score: 0,
  };
}

// Certified Pre-Owned marker in listing text. Anchored phrases + the "cpo" token (word-bounded
// so it doesn't match inside unrelated words). Bare "certified" is deliberately excluded — it
// shows up in unrelated dealer copy ("certified technicians").
const CPO_RE = /\bcpo\b|certified pre[\s-]?owned/i;

const MAX_BODY_SWEEPS = 3; // cap broad body-style queries (covers most multi-body selections)
const ROWS_PER_SWEEP = 50; // a sweep covers many makes; pull plenty so keyword post-filtering has candidates

// Map our UI body-style names to Marketcheck's `body_type` facet values.
const MC_BODY_TYPE: Record<string, string> = {
  suv: "SUV",
  sedan: "Sedan",
  truck: "Pickup",
  pickup: "Pickup",
  hatchback: "Hatchback",
  wagon: "Wagon",
  coupe: "Coupe",
  convertible: "Convertible",
  van: "Van",
  minivan: "Minivan",
};

/**
 * Shared constraint params (budget, mileage, transmission, drivetrain, cylinders, fuel, location)
 * used by BOTH the per-model queries and the body-style sweep. `make`/`model`/`year_range`/
 * `body_type` are added by the caller.
 */
function baseParams(apiKey: string, plan: SearchPlan, rows: number): URLSearchParams {
  const { constraints } = plan;
  const params = new URLSearchParams({ api_key: apiKey, rows: String(rows), car_type: "used" });
  // Fuel handling is quirky on Marketcheck: it tags hybrids as "Unleaded" (hybrid-ness lives in
  // the model name/heading), so fuel_type=Hybrid returns nothing. Electric/Diesel ARE tagged
  // correctly. So: hybrid -> keyword "Hybrid"; electric/diesel -> fuel_type.
  const keywordParts: string[] = [];
  if (constraints.keywords) keywordParts.push(constraints.keywords);
  if (constraints.fuel_type === "hybrid") keywordParts.push("Hybrid");
  if (constraints.fuel_type === "electric") params.set("fuel_type", "Electric");
  if (constraints.fuel_type === "diesel") params.set("fuel_type", "Diesel");
  if (constraints.budget_max) params.set("price_range", `0-${Math.round(constraints.budget_max)}`);
  if (constraints.max_mileage) params.set("miles_range", `0-${Math.round(constraints.max_mileage)}`);
  if (constraints.transmission) {
    params.set("transmission", constraints.transmission === "manual" ? "Manual" : "Automatic");
  }
  // NOTE: we do NOT send a `drivetrain` filter to Marketcheck — its param is broken (drivetrain=AWD
  // returns zero even nationwide, and it tags many AWD crossovers as "4WD" anyway). Drivetrain is
  // enforced reliably by the aggregate post-filter against each listing's decoded drivetrain field.
  if (constraints.cylinders) params.set("cylinders", String(constraints.cylinders));
  if (keywordParts.length) params.set("keyword", keywordParts.join(" "));
  // For "nationwide" (sentinel) drop BOTH zip and radius — Marketcheck treats zip with no radius
  // as exact-zip (returns ~nothing), so a true national search must omit the zip entirely.
  const nationwide = (constraints.radius_miles ?? 0) >= 5000;
  if (constraints.zip_code && !nationwide) params.set("zip", constraints.zip_code);
  // The Marketcheck plan caps radius at 100 mi — a larger value returns HTTP 422 (zero results),
  // so clamp it. Cars beyond 100 mi still come from the keyless sources, and zip is kept so we
  // retain the distance figure for everything within range.
  if (constraints.radius_miles && !nationwide) {
    params.set("radius", String(Math.min(constraints.radius_miles, MC_MAX_RADIUS)));
  }
  return params;
}

export async function search(plan: SearchPlan): Promise<NormalizedListing[]> {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) return []; // gracefully skip when not configured

  const { constraints, automotive_targets } = plan;
  const models =
    automotive_targets.suggested_models.length > 0
      ? automotive_targets.suggested_models.slice(0, MAX_MODELS)
      : [null];

  // Per-model queries: the LLM's curated picks (carry reliability reasoning).
  const modelRequests = models.map((m) => {
    const params = baseParams(apiKey, plan, ROWS_PER_MODEL);
    if (m) {
      params.set("make", m.make);
      // Strip fuel suffixes ("Highlander Hybrid" -> "Highlander", "Bolt EV" -> "Bolt") so the
      // base-model query matches; hybrid intent is then caught by the keyword + post-filter.
      params.set("model", m.model.replace(/\s+(plug-in hybrid|hybrid|ev|electric)$/i, "").trim());
      params.set("year_range", `${m.years.min}-${m.years.max}`);
    }
    return getJson(`${BASE}?${params.toString()}`);
  });

  // Body-style sweep: query by body_type across ALL makes (what a meta-search like AutoTempest
  // does). This is what stops a valid SUV/truck the LLM didn't happen to name from being invisible.
  const yearRange =
    constraints.year_min || constraints.year_max
      ? `${constraints.year_min ?? 1990}-${constraints.year_max ?? new Date().getFullYear() + 1}`
      : null;
  // The sweep runs even with a keyword present: brand/trim terms like "AMG" don't map to a
  // Marketcheck model (AMG C63 is model "C-Class", trim "C 63 AMG"), so a model-only search misses
  // them. The body-type sweep surfaces candidates and the keyword post-filter (in aggregate) keeps
  // only true matches.
  const sweepRequests = automotive_targets.body_styles
    .map((bs) => MC_BODY_TYPE[bs.toLowerCase()])
    .filter((v): v is string => !!v)
    .slice(0, MAX_BODY_SWEEPS)
    .map((bodyType) => {
      const params = baseParams(apiKey, plan, ROWS_PER_SWEEP);
      params.set("body_type", bodyType);
      if (yearRange) params.set("year_range", yearRange);
      return getJson(`${BASE}?${params.toString()}`);
    });

  const results = await Promise.all([...modelRequests, ...sweepRequests]);
  const out: NormalizedListing[] = [];
  for (const r of results) {
    for (const l of r?.listings ?? []) {
      const mapped = mapListing(l);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

/**
 * Cheap availability probe for the health banner. A `429` (quota exhausted) does NOT consume a
 * query, so polling this while we're out of quota is free; one tiny `rows=1` call confirms recovery.
 */
export async function marketcheckStatus(): Promise<"ok" | "quota" | "down" | "unconfigured"> {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) return "unconfigured";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const params = new URLSearchParams({ api_key: apiKey, car_type: "used", rows: "1" });
    const res = await fetch(`${BASE}?${params.toString()}`, { signal: ctrl.signal, cache: "no-store" });
    if (res.status === 429) return "quota";
    if (!res.ok) return "down";
    const d = (await res.json()) as { listings?: unknown[] };
    return (d.listings?.length ?? 0) > 0 ? "ok" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(t);
  }
}
