import { NextRequest } from "next/server";
import { decodeVin, type VinDecodeResult } from "@/lib/vin";
import { cacheGet, cacheSet } from "@/lib/limits";

export const runtime = "nodejs";
export const maxDuration = 10;

/** On-demand VIN verification (fired when a detail modal with a VIN opens). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vin = searchParams.get("vin");
  if (!vin || vin.length < 11) return new Response("valid vin required", { status: 400 });

  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const yearRaw = searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : null;

  const cacheKey = `acs:vin:${vin}|${make ?? ""}|${model ?? ""}|${year ?? ""}`.toLowerCase();
  const cached = await cacheGet<VinDecodeResult>(cacheKey);
  if (cached) return Response.json(cached);

  const result = await decodeVin(vin, { make, model, year });
  if (!result) return new Response("VIN lookup failed", { status: 502 });
  await cacheSet(cacheKey, result);
  return Response.json(result);
}
