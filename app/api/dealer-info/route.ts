import { NextRequest } from "next/server";
import { getDealerInfo, hasGooglePlaces, type DealerInfo } from "@/lib/dealer";
import { cacheGet, cacheSet } from "@/lib/limits";

export const runtime = "nodejs";
export const maxDuration = 10;

/** On-demand dealer reputation lookup (fired when a detail modal with a dealer opens). */
export async function GET(req: NextRequest) {
  if (!hasGooglePlaces) return Response.json(null); // feature off — caller hides the UI

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return Response.json(null);
  const city = searchParams.get("city");
  const state = searchParams.get("state");

  // Cache misses and "Google has no rating" both surface as null from cacheGet, so a plain
  // null would re-query Google forever for unrated dealers (cost + latency). Store an explicit
  // sentinel for the not-found case so negatives are cached too.
  const cacheKey = `acs:dealer:${name}|${city ?? ""}|${state ?? ""}`.toLowerCase();
  const cached = await cacheGet<DealerInfo | { none: true }>(cacheKey);
  if (cached) return Response.json("none" in cached ? null : cached);

  const info = await getDealerInfo(name, city, state);
  await cacheSet(cacheKey, info ?? { none: true });
  return Response.json(info);
}
