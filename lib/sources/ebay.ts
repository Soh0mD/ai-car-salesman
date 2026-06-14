import type { NormalizedListing, SearchPlan, SuggestedModel } from "../types";

/**
 * eBay Browse API — private-party + enthusiast inventory. Free developer account.
 * Uses the OAuth client-credentials grant; the app token is cached in-process until it
 * nears expiry so we don't mint a new one per request.
 * Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
 */

const OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const SCOPE = "https://api.ebay.com/oauth/api_scope";
const MOTORS_CARS_CATEGORY = "6001"; // Cars & Trucks
const FETCH_TIMEOUT_MS = 9000;
const MAX_MODELS = 4;
const LIMIT_PER_MODEL = 15;

let token: { value: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string | null> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (token && Date.now() < token.expiresAt - 60_000) return token.value;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(OAUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    token = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    return token.value;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

interface EbayItem {
  title?: string;
  price?: { value?: string };
  image?: { imageUrl?: string };
  thumbnailImages?: { imageUrl?: string }[];
  itemWebUrl?: string;
  itemLocation?: { postalCode?: string };
  seller?: { username?: string };
}

const YEAR_RE = /\b(19[8-9]\d|20[0-4]\d)\b/;

function mapItem(item: EbayItem, hint: SuggestedModel | null): NormalizedListing | null {
  if (!item.itemWebUrl) return null;
  const title = item.title ?? "";
  const yearMatch = title.match(YEAR_RE);
  const price = item.price?.value ? Number(item.price.value) : null;
  return {
    source: "ebay",
    title,
    year: yearMatch ? Number(yearMatch[0]) : null,
    make: hint?.make ?? null,
    model: hint?.model ?? null,
    trim: null,
    price: Number.isFinite(price) ? price : null,
    mileage: null, // not in item summary; would require getItem detail call
    vin: null,
    zip: item.itemLocation?.postalCode ?? null,
    distance_miles: null,
    image_url: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl ?? null,
    images: item.image?.imageUrl ? [item.image.imageUrl] : [],
    listing_url: item.itemWebUrl,
    dealer_name: item.seller?.username ?? null,
    drivetrain: null,
    transmission: null,
    fuel_type: null,
    cylinders: null,
    body_style: null,
    recall_count: null,
    complaints: null,
    reliability_flag: null,
    value_score: 0,
  };
}

export async function search(plan: SearchPlan): Promise<NormalizedListing[]> {
  const appToken = await getAppToken();
  if (!appToken) return []; // not configured or auth failed -> skip gracefully

  const { constraints, automotive_targets } = plan;
  const models: (SuggestedModel | null)[] =
    automotive_targets.suggested_models.length > 0
      ? automotive_targets.suggested_models.slice(0, MAX_MODELS)
      : [null];

  const headers = {
    Authorization: `Bearer ${appToken}`,
    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
  };

  const requests = models.map(async (m) => {
    const params = new URLSearchParams({
      q: m ? `${m.make} ${m.model}` : "car",
      category_ids: MOTORS_CARS_CATEGORY,
      limit: String(LIMIT_PER_MODEL),
    });
    if (constraints.budget_max) {
      params.set("filter", `price:[..${Math.round(constraints.budget_max)}],priceCurrency:USD`);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
        headers,
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { itemSummaries?: EbayItem[] };
      return (data.itemSummaries ?? [])
        .map((it) => mapItem(it, m))
        .filter((x): x is NormalizedListing => x !== null);
    } catch {
      return [];
    } finally {
      clearTimeout(t);
    }
  });

  const results = await Promise.all(requests);
  return results.flat();
}
