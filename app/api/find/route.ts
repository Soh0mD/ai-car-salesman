import { NextRequest } from "next/server";
import { runConversationalSearch, sseResponse, briefFromProfile } from "@/lib/pipeline";
import { checkRateLimit, cacheGet, cacheSet, planCacheKey, clientIp } from "@/lib/limits";
import type { NormalizedListing, WizardProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CachedResponse {
  reply: string;
  listings: NormalizedListing[];
  counts: Record<string, number>;
}

/** Structured wizard search. The profile deterministically drives constraints (repeatable). */
export async function POST(req: NextRequest) {
  let profile: WizardProfile;
  try {
    const body = (await req.json()) as { profile?: WizardProfile };
    if (!body.profile?.zip_code || !body.profile.budget_max) {
      return new Response("Missing required profile fields", { status: 400 });
    }
    profile = body.profile;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!(await checkRateLimit(clientIp(req)))) {
    return new Response("Rate limit exceeded. Please slow down.", { status: 429 });
  }

  return sseResponse(async (send) => {
    // Identical profile -> identical cached result (repeatability + cost cap).
    const cacheKey = planCacheKey({ profile });
    const cached = await cacheGet<CachedResponse>(cacheKey);
    if (cached) {
      send("reply_delta", { text: cached.reply });
      send("listings", { listings: cached.listings, counts: cached.counts, enriched: true });
      send("done", {});
      return;
    }

    const messages = [{ role: "user" as const, content: briefFromProfile(profile) }];
    const { replyText, listings, counts } = await runConversationalSearch(messages, send, profile);
    await cacheSet(cacheKey, { reply: replyText, listings, counts } satisfies CachedResponse);
    send("done", {});
  });
}
