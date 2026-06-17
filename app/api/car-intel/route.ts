import { NextRequest } from "next/server";
import { getFuelEconomy } from "@/lib/fueleconomy";
import { getSafetyRating } from "@/lib/nhtsa";
import { cacheGet, cacheSet } from "@/lib/limits";
import type { CarIntel } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

const EMPTY: CarIntel = { mpg: null, annualFuelCost: null, evRange: null, safety: null };

/** On-demand running-cost + safety for one car (fetched when a detail modal opens). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const year = Number(searchParams.get("year"));
  if (!make || !model || !Number.isFinite(year)) return Response.json(EMPTY);

  const cacheKey = `acs:intel:${make}|${model}|${year}`.toLowerCase();
  const cached = await cacheGet<CarIntel>(cacheKey);
  if (cached) return Response.json(cached);

  const [fuel, safety] = await Promise.all([
    getFuelEconomy(make, model, year),
    getSafetyRating(make, model, year),
  ]);
  const intel: CarIntel = {
    mpg: fuel?.mpg ?? null,
    annualFuelCost: fuel?.annualFuelCost ?? null,
    evRange: fuel?.evRange ?? null,
    safety,
  };
  await cacheSet(cacheKey, intel);
  return Response.json(intel);
}
