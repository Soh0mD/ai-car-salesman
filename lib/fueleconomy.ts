/**
 * EPA fuel-economy + estimated annual fuel cost via FuelEconomy.gov (free, no key).
 * Three-step lookup (FuelEconomy splits models by drivetrain, e.g. "CR-V AWD"):
 *   model menu -> options (vehicle id) -> vehicle detail. Cached + timeout-guarded.
 */

const FE_BASE = "https://www.fueleconomy.gov/ws/rest";
const TIMEOUT_MS = 6000;

export interface FuelEconomy {
  mpg: number | null; // combined
  annualFuelCost: number | null; // $/yr (EPA estimate)
  evRange: number | null; // miles (EVs only)
}

type MenuItem = { value?: string; text?: string };

const cache = new Map<string, FuelEconomy | null>();

async function feJson(path: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${FE_BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function items(data: unknown): MenuItem[] {
  const mi = (data as { menuItem?: MenuItem | MenuItem[] } | null)?.menuItem;
  if (!mi) return [];
  return Array.isArray(mi) ? mi : [mi];
}

function num(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getFuelEconomy(
  make: string,
  model: string,
  year: number,
): Promise<FuelEconomy | null> {
  const key = `${make}|${model}|${year}`.toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const fail = () => {
    cache.set(key, null);
    return null;
  };

  // 1) Find a model entry matching ours (FuelEconomy names like "CR-V AWD").
  const models = items(
    await feJson(`/vehicle/menu/model?year=${year}&make=${encodeURIComponent(make)}`),
  );
  const ml = model.toLowerCase();
  const match =
    models.find((m) => (m.value ?? "").toLowerCase().includes(ml))?.value ??
    models.find((m) => ml.includes((m.value ?? "").toLowerCase().split(" ")[0]))?.value;
  if (!match) return fail();

  // 2) Options -> first vehicle id.
  const id = items(
    await feJson(
      `/vehicle/menu/options?year=${year}&make=${encodeURIComponent(
        make,
      )}&model=${encodeURIComponent(match)}`,
    ),
  )[0]?.value;
  if (!id) return fail();

  // 3) Vehicle detail.
  const v = (await feJson(`/vehicle/${id}`)) as {
    comb08?: unknown;
    fuelCost08?: unknown;
    range?: unknown;
  } | null;
  if (!v) return fail();

  const result: FuelEconomy = {
    mpg: num(v.comb08),
    annualFuelCost: num(v.fuelCost08),
    evRange: num(v.range),
  };
  cache.set(key, result);
  return result;
}
