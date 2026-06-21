/**
 * Dealer reputation via the Google Places API (Text Search, New). Answers "is this dealer
 * legit?" with an aggregate star rating + review count right on the listing. Gated behind
 * GOOGLE_PLACES_API_KEY — absent = the feature no-ops and the rest of the app is unaffected.
 *
 * Cost note: Places Text Search bills per request, but Google's $200/mo free credit covers
 * thousands of lookups, and results are cached, so a capped demo stays free.
 */

const PLACES_SEARCH = "https://places.googleapis.com/v1/places:searchText";
const FETCH_TIMEOUT_MS = 5000;

export const hasGooglePlaces = !!process.env.GOOGLE_PLACES_API_KEY;

export interface DealerInfo {
  rating: number;
  reviewCount: number;
}

const dealerCache = new Map<string, DealerInfo | null>();

/** Look up a dealer's aggregate Google rating. Returns null if unconfigured or not found. */
export async function getDealerInfo(
  name: string,
  city: string | null,
  state: string | null,
): Promise<DealerInfo | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !name) return null;

  const query = [name, "car dealer", city, state].filter(Boolean).join(" ");
  const cacheKey = query.toLowerCase();
  if (dealerCache.has(cacheKey)) return dealerCache.get(cacheKey) ?? null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(PLACES_SEARCH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Field mask keeps the request in the cheapest billing tier (only what we render).
        "X-Goog-FieldMask": "places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      dealerCache.set(cacheKey, null);
      return null;
    }
    const data = (await res.json()) as {
      places?: { rating?: number; userRatingCount?: number }[];
    };
    const p = data.places?.[0];
    if (!p || typeof p.rating !== "number") {
      dealerCache.set(cacheKey, null);
      return null;
    }
    const info: DealerInfo = { rating: p.rating, reviewCount: p.userRatingCount ?? 0 };
    dealerCache.set(cacheKey, info);
    return info;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
