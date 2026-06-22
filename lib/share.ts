import type { WizardProfile } from "./types";

/**
 * Search persistence helpers: encode a profile into a shareable URL (so a search can be
 * bookmarked or sent to a friend) and remember the last search in localStorage (so a returning
 * visitor can pick up where they left off). All browser-only; guarded for SSR.
 */

/** A profile looks valid enough to act on (defensive — URLs and storage can be tampered/stale). */
function looksLikeProfile(o: unknown): boolean {
  return (
    !!o &&
    typeof o === "object" &&
    typeof (o as WizardProfile).budget_max === "number" &&
    typeof (o as WizardProfile).zip_code === "string"
  );
}

/**
 * Coerce a parsed object into a COMPLETE WizardProfile. A profile arriving from a shared URL or
 * from localStorage (possibly tampered, or saved by an older app version before the `fuel`->`fuels`
 * rename) may be missing fields — consumers like the Landing chip and Results summary access arrays
 * and strings directly, so an undefined `body_styles`/`keywords` would crash the render. Filling a
 * full default shape here makes every downstream read safe.
 */
function normalizeProfile(o: Record<string, unknown>): WizardProfile {
  const year = new Date().getFullYear();
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : d;
  return {
    budget_max: num(o.budget_max, 20000),
    zip_code: str(o.zip_code, ""),
    radius_miles: num(o.radius_miles, 50),
    seats: num(o.seats, 0),
    year_min: num(o.year_min, year - 10),
    year_max: num(o.year_max, year),
    max_mileage: num(o.max_mileage, 100000),
    primary_use: oneOf(o.primary_use, ["commute", "family", "fun", "first_car", "work"], "commute"),
    fuel_priority: oneOf(o.fuel_priority, ["low", "medium", "high"], "medium"),
    safety: num(o.safety, 3),
    fun: num(o.fun, 3),
    drivetrain: oneOf(o.drivetrain, ["any", "awd", "4wd", "fwd", "rwd"], "any"),
    transmission: oneOf(o.transmission, ["any", "automatic", "manual"], "any"),
    fuels: strArr(o.fuels),
    cylinders: num(o.cylinders, 0),
    keywords: str(o.keywords, ""),
    body_styles: strArr(o.body_styles),
    excluded_body_styles: strArr(o.excluded_body_styles),
  };
}

/** URL-safe base64 of the JSON profile (compact enough for a query param). */
export function encodeProfile(p: WizardProfile): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(p)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch {
    return "";
  }
}

export function decodeProfile(s: string): WizardProfile | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const o = JSON.parse(decodeURIComponent(atob(b64)));
    return looksLikeProfile(o) ? normalizeProfile(o) : null;
  } catch {
    return null;
  }
}

/** Build the full shareable URL for a search. */
export function shareUrlForProfile(p: WizardProfile): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://dascar.xyz";
  return `${origin}/?s=${encodeProfile(p)}`;
}

/** Read a profile from the current URL's `?s=` param, if any. */
export function profileFromUrl(): WizardProfile | null {
  if (typeof window === "undefined") return null;
  const s = new URLSearchParams(window.location.search).get("s");
  return s ? decodeProfile(s) : null;
}

const LAST_KEY = "dascar:lastSearch";

export function saveLastSearch(p: WizardProfile): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal */
  }
}

export function loadLastSearch(): WizardProfile | null {
  try {
    const s = localStorage.getItem(LAST_KEY);
    if (!s) return null;
    const o = JSON.parse(s);
    return looksLikeProfile(o) ? normalizeProfile(o) : null;
  } catch {
    return null;
  }
}
