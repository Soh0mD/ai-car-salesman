import { NextRequest } from "next/server";
import { scanPhotoForDamage, type PhotoScanResult } from "@/lib/llm";
import { cacheGet, cacheSet, checkRateLimit, clientIp, hasUpstash } from "@/lib/limits";

export const runtime = "nodejs";
export const maxDuration = 20;

/** On-demand AI damage scan of one listing photo (user-triggered from the detail modal). */
export async function POST(req: NextRequest) {
  // Vision calls cost money and the per-IP rate limit is a no-op without Upstash. So until
  // Redis is configured (which also enables the rate limit), keep this feature off so the
  // public demo can't be farmed for vision spend. Auto-enables the moment Upstash is set.
  if (!hasUpstash) {
    return new Response("Photo scanning is currently unavailable.", { status: 503 });
  }

  let body: { photoUrl?: string; year?: number; make?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body.photoUrl || !/^https?:\/\//i.test(body.photoUrl)) {
    return new Response("photoUrl required", { status: 400 });
  }

  // Vision calls cost money — rate-limit per IP (paywall comes later).
  if (!(await checkRateLimit(clientIp(req)))) {
    return new Response("Rate limit exceeded. Please slow down.", { status: 429 });
  }

  const cacheKey = `acs:photo:${body.photoUrl}`.toLowerCase();
  const cached = await cacheGet<PhotoScanResult>(cacheKey);
  if (cached) return Response.json(cached);

  try {
    const result = await scanPhotoForDamage(body.photoUrl, {
      year: body.year ?? null,
      make: body.make ?? null,
      model: body.model ?? null,
    });
    await cacheSet(cacheKey, result);
    return Response.json(result);
  } catch {
    return new Response("Could not scan photo.", { status: 502 });
  }
}
