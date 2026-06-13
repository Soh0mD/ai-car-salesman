import type { NormalizedListing, SearchPlan } from "../types";

/**
 * Marketcheck — the dealer-inventory backbone (aggregates the big dealer sites).
 * Free tier: instant key, ~50K-100K queries/mo. Docs: https://docs.marketcheck.com
 *
 * Field mappings follow the v2 /search/car/active response shape. If a future API
 * revision renames fields, this mapper degrades gracefully (optional chaining + nulls)
 * rather than throwing — sanity-check once with scripts/test-source.ts after adding a key.
 */

const BASE = "https://mc-api.marketcheck.com/v2/search/car/active";
const FETCH_TIMEOUT_MS = 9000;
const MAX_MODELS = 4; // cap parallel sub-queries to stay polite to the free tier
const ROWS_PER_MODEL = 15;

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
  return {
    source: "marketcheck",
    title: l.heading ?? [l.build?.year, l.build?.make, l.build?.model].filter(Boolean).join(" "),
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
    listing_url: l.vdp_url,
    dealer_name: l.dealer?.name ?? null,
    drivetrain: l.build?.drivetrain ?? null,
    body_style: l.build?.body_type ?? null,
    recall_count: null,
    complaints: null,
    reliability_flag: null,
    value_score: 0,
  };
}

export async function search(plan: SearchPlan): Promise<NormalizedListing[]> {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) return []; // gracefully skip when not configured

  const { constraints, automotive_targets } = plan;
  const models =
    automotive_targets.suggested_models.length > 0
      ? automotive_targets.suggested_models.slice(0, MAX_MODELS)
      : [null];

  const requests = models.map((m) => {
    const params = new URLSearchParams({
      api_key: apiKey,
      rows: String(ROWS_PER_MODEL),
      car_type: "used",
    });
    if (m) {
      params.set("make", m.make);
      params.set("model", m.model);
      params.set("year_range", `${m.years.min}-${m.years.max}`);
    }
    if (constraints.budget_max) params.set("price_range", `0-${Math.round(constraints.budget_max)}`);
    if (constraints.zip_code) params.set("zip", constraints.zip_code);
    if (constraints.radius_miles) params.set("radius", String(constraints.radius_miles));
    return getJson(`${BASE}?${params.toString()}`);
  });

  const results = await Promise.all(requests);
  const out: NormalizedListing[] = [];
  for (const r of results) {
    for (const l of r?.listings ?? []) {
      const mapped = mapListing(l);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}
