/**
 * VIN verification via NHTSA's free VPIC decoder (no key). This is a fraud/sanity layer:
 * confirm a VIN is real and that it decodes to the same year/make/model the listing claims
 * (a mismatch is a strong red flag). For full title history — salvage/flood/junk brands,
 * owner count, odometer — the UI deep-links to the free government NMVTIS portal
 * (vehiclehistory.gov); we don't (and legally can't) scrape that here.
 *
 * Mirrors the lib/nhtsa.ts pattern: timeout-guarded fetch + in-process cache.
 */

const VPIC_DECODE = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";
const FETCH_TIMEOUT_MS = 4500;

export interface VinDecodeResult {
  valid: boolean;
  make: string | null;
  model: string | null;
  year: number | null;
  manufacturer: string | null;
  plantCountry: string | null;
  /**
   * True only when the decoded YEAR or MAKE contradicts the listing — the reliable fraud
   * signals. Model name is deliberately excluded (VPIC vs. inventory feeds disagree on model
   * naming constantly, e.g. "3 Series" vs "330i", which would manufacture false alarms).
   */
  specMismatch: boolean;
  /** Informational only: decoded model differs from the listing's (NOT treated as fraud). */
  modelDiffers: boolean;
}

// Common make aliases so a feed saying "Chevy"/"VW"/"Mercedes" doesn't false-flag against
// VPIC's canonical "CHEVROLET"/"VOLKSWAGEN"/"MERCEDES-BENZ".
const MAKE_ALIASES: Record<string, string> = {
  chevy: "chevrolet",
  vw: "volkswagen",
  mercedes: "mercedes-benz",
  benz: "mercedes-benz",
  mb: "mercedes-benz",
  "gmc truck": "gmc",
};

function normalizeMake(m: string): string {
  const k = m.toLowerCase().trim();
  return MAKE_ALIASES[k] ?? k;
}

// VINs are immutable, so a decode never changes — cache for the life of the process.
const vinCache = new Map<string, VinDecodeResult>();

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Decode a VIN and compare it against the listing's claimed make/model/year. `claimed` is
 * optional — pass it to get the specMismatch fraud signal. Returns null only on lookup failure.
 */
export async function decodeVin(
  vin: string,
  claimed?: { make?: string | null; model?: string | null; year?: number | null },
): Promise<VinDecodeResult | null> {
  const cleanVin = vin.trim().toUpperCase();
  const cacheKey = `${cleanVin}|${claimed?.make ?? ""}|${claimed?.model ?? ""}|${claimed?.year ?? ""}`.toLowerCase();
  const cached = vinCache.get(cacheKey);
  if (cached) return cached;

  const data = (await getJson(`${VPIC_DECODE}/${encodeURIComponent(cleanVin)}?format=json`)) as {
    Results?: Record<string, string>[];
  } | null;
  const r = data?.Results?.[0];
  if (!r) return null;

  const decodedYear = r.ModelYear ? parseInt(r.ModelYear, 10) : null;
  const decodedMake = r.Make || null;
  const decodedModel = r.Model || null;
  // ErrorCode "0" means a clean decode; anything else means VPIC flagged a problem.
  const errorCode = (r.ErrorCode ?? "").split(",")[0]?.trim();
  const valid = !!decodedMake && (errorCode === "0" || errorCode === "");

  // Fraud signal: only YEAR and MAKE are reliable enough to flag. Model naming diverges too
  // much between VPIC and inventory feeds to treat as fraud (it becomes an informational note).
  let specMismatch = false;
  let modelDiffers = false;
  if (valid && claimed) {
    if (claimed.year && decodedYear && claimed.year !== decodedYear) specMismatch = true;
    if (claimed.make && decodedMake && normalizeMake(claimed.make) !== normalizeMake(decodedMake)) {
      specMismatch = true;
    }
    if (claimed.model && decodedModel) {
      const a = claimed.model.toLowerCase().trim();
      const b = decodedModel.toLowerCase().trim();
      modelDiffers = !(a === b || a.includes(b) || b.includes(a));
    }
  }

  const result: VinDecodeResult = {
    valid,
    make: decodedMake,
    model: decodedModel,
    year: Number.isFinite(decodedYear) ? decodedYear : null,
    manufacturer: r.Manufacturer || r.ManufacturerName || null,
    plantCountry: r.PlantCountry || null,
    specMismatch,
    modelDiffers,
  };
  if (valid) vinCache.set(cacheKey, result);
  return result;
}
