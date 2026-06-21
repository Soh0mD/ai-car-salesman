import { NextRequest } from "next/server";
import { getBuyingTips } from "@/lib/llm";
import { cacheGet, cacheSet, checkRateLimit, clientIp } from "@/lib/limits";
import type { AdviceResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 20;

/** On-demand, deterministic buying tips for one car (triggered from the detail modal). */
export async function POST(req: NextRequest) {
  let body: { year?: number; make?: string; model?: string; trim?: string; price?: number; mileage?: number; privateSeller?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body.make || !body.model) return new Response("make and model required", { status: 400 });

  if (!(await checkRateLimit(clientIp(req)))) {
    return new Response("Rate limit exceeded. Please slow down.", { status: 429 });
  }

  // Bucket the price so trivially-different asks share a cache entry (still deterministic).
  const priceBucket = body.price != null ? Math.round(body.price / 1000) : 0;
  const seller = body.privateSeller ? "p" : "d";
  const cacheKey = `acs:advise:${body.year}|${body.make}|${body.model}|${body.trim ?? ""}|${priceBucket}|${seller}`.toLowerCase();
  const cached = await cacheGet<AdviceResult>(cacheKey);
  if (cached) return Response.json(cached);

  try {
    const tips = await getBuyingTips({
      year: body.year ?? null,
      make: body.make ?? null,
      model: body.model ?? null,
      trim: body.trim ?? null,
      price: body.price ?? null,
      mileage: body.mileage ?? null,
      privateSeller: body.privateSeller ?? false,
    });
    await cacheSet(cacheKey, tips);
    return Response.json(tips);
  } catch {
    return new Response("Could not generate buying tips.", { status: 502 });
  }
}
