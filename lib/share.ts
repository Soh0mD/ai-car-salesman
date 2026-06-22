import type { WizardProfile } from "./types";

/**
 * Search persistence helpers: encode a profile into a shareable URL (so a search can be
 * bookmarked or sent to a friend) and remember the last search in localStorage (so a returning
 * visitor can pick up where they left off). All browser-only; guarded for SSR.
 */

/** A profile looks valid enough to act on (defensive — URLs and storage can be tampered/stale). */
function looksLikeProfile(o: unknown): o is WizardProfile {
  return (
    !!o &&
    typeof o === "object" &&
    typeof (o as WizardProfile).budget_max === "number" &&
    typeof (o as WizardProfile).zip_code === "string"
  );
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
    return looksLikeProfile(o) ? o : null;
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
    return looksLikeProfile(o) ? o : null;
  } catch {
    return null;
  }
}
