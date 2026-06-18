import { NextRequest } from "next/server";
import { searchForProfile, briefFromProfile } from "@/lib/pipeline";
import {
  allSavedUsers,
  listSavedSearches,
  updateSavedState,
  savedSearchesEnabled,
  type SavedSearch,
} from "@/lib/saved-searches";
import { emailEnabled, sendEmail } from "@/lib/email";
import type { NormalizedListing } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Saved-search alert sweep (Wave 4). Triggered by Vercel Cron (see vercel.json). Re-runs every
 * saved search, diffs against the last-seen VINs + prices, and emails new matches / price drops.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token on scheduled invocations).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  }
  if (!savedSearchesEnabled()) return Response.json({ ok: false, reason: "storage not configured" });

  const users = await allSavedUsers();
  let processed = 0;
  let emailsSent = 0;

  for (const anonId of users) {
    const searches = await listSavedSearches(anonId);
    for (const s of searches) {
      processed++;
      let listings: NormalizedListing[];
      try {
        listings = await searchForProfile(s.profile);
      } catch {
        continue; // one failing search shouldn't sink the sweep
      }
      const withVin = listings.filter((l) => l.vin);
      const currentVins = withVin.map((l) => l.vin!.toUpperCase());
      const lastVinSet = new Set(s.lastVins);

      // First run just seeds the baseline (no spam on the very first sweep).
      const isFirstRun = s.lastVins.length === 0;
      const newCars = isFirstRun ? [] : withVin.filter((l) => !lastVinSet.has(l.vin!.toUpperCase()));
      const drops = isFirstRun
        ? []
        : withVin.filter((l) => {
            const prev = s.lastPrices[l.vin!.toUpperCase()];
            return prev != null && l.price != null && l.price < prev;
          });

      if (s.email && emailEnabled() && (newCars.length > 0 || drops.length > 0)) {
        const ok = await sendEmail(s.email, alertSubject(s, newCars.length, drops.length), alertHtml(s, newCars, drops));
        if (ok) emailsSent++;
      }

      const nextPrices: Record<string, number> = {};
      for (const l of withVin) if (l.price != null) nextPrices[l.vin!.toUpperCase()] = l.price;
      await updateSavedState(anonId, s.id, currentVins, nextPrices);
    }
  }

  return Response.json({ ok: true, users: users.length, processed, emailsSent });
}

function alertSubject(s: SavedSearch, newCount: number, dropCount: number): string {
  const parts: string[] = [];
  if (newCount) parts.push(`${newCount} new match${newCount === 1 ? "" : "es"}`);
  if (dropCount) parts.push(`${dropCount} price drop${dropCount === 1 ? "" : "s"}`);
  return `dascar: ${parts.join(" + ")} for your saved search`;
}

function carRow(l: NormalizedListing, note?: string): string {
  const price = l.price != null ? `$${l.price.toLocaleString("en-US")}` : "—";
  return `<li><strong>${l.title || "Vehicle"}</strong> — ${price}${note ? ` <em>(${note})</em>` : ""} · <a href="${l.listing_url}">view</a></li>`;
}

function alertHtml(s: SavedSearch, newCars: NormalizedListing[], drops: NormalizedListing[]): string {
  let html = `<p>New activity on your saved dascar search (${briefFromProfile(s.profile)}):</p>`;
  if (newCars.length) html += `<h3>New matches</h3><ul>${newCars.slice(0, 10).map((l) => carRow(l)).join("")}</ul>`;
  if (drops.length) {
    html += `<h3>Price drops</h3><ul>${drops
      .slice(0, 10)
      .map((l) => carRow(l, `now $${(l.price ?? 0).toLocaleString("en-US")}`))
      .join("")}</ul>`;
  }
  html += `<p style="color:#888;font-size:12px">You're getting this because you saved a search on dascar.</p>`;
  return html;
}
