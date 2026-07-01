import { marketcheckStatus, marketcheckQuotaRemaining } from "@/lib/sources/marketcheck";
import { ebayStatus } from "@/lib/sources/ebay";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * Inventory health for the maintenance banner. The site is "ok" if ANY listings source can return
 * cars. Probes are cheap: Marketcheck's 429 (quota exhausted) doesn't consume a query, and the
 * eBay check is just an OAuth token. Results are cached in-process — short while down (so recovery
 * shows within minutes) and long while up (so we don't spend the scarce Marketcheck quota probing).
 */
let cache: { ok: boolean; reason: string; at: number } | null = null;
const TTL_UP = 6 * 60 * 60 * 1000; // 6h
const TTL_DOWN = 5 * 60 * 1000; // 5min

export async function GET() {
  const ttl = cache?.ok ? TTL_UP : TTL_DOWN;
  if (cache && Date.now() - cache.at < ttl) {
    return Response.json({ ok: cache.ok, reason: cache.reason, quota: marketcheckQuotaRemaining() });
  }

  const [mc, eb] = await Promise.all([marketcheckStatus(), ebayStatus()]);
  const ok = mc === "ok" || eb === "ok";
  let reason = "";
  if (!ok) {
    reason =
      mc === "quota"
        ? "Our main inventory provider's monthly quota is temporarily used up — live results will be back soon."
        : "Live inventory is temporarily unavailable — please check back shortly.";
  }
  cache = { ok, reason, at: Date.now() };
  // `quota` = last-seen Marketcheck monthly quota remaining (ops visibility; null on cold start).
  return Response.json({ ok, reason, quota: marketcheckQuotaRemaining() });
}
