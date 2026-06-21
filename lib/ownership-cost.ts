/**
 * True cost of ownership — the signal sticker-price comparisons hide. All values are
 * hardcoded national averages (no API, instant), so treat them as ballpark guidance, not
 * quotes. Powers the 5-year cost estimate + depreciation indicator in the detail modal.
 *
 * Sources: RepairPal annual-maintenance averages by brand; industry depreciation norms.
 */

// Average annual maintenance + repair cost by make (RepairPal-style brand averages).
const MAINTENANCE_COST: Record<string, number> = {
  toyota: 441,
  lexus: 551,
  honda: 428,
  acura: 501,
  mazda: 462,
  subaru: 617,
  ford: 775,
  lincoln: 879,
  chevrolet: 649,
  gmc: 744,
  buick: 608,
  cadillac: 783,
  dodge: 634,
  ram: 634,
  chrysler: 624,
  jeep: 634,
  bmw: 968,
  mercedes: 908,
  "mercedes-benz": 908,
  audi: 987,
  volkswagen: 676,
  volvo: 769,
  porsche: 1192,
  hyundai: 468,
  genesis: 565,
  kia: 474,
  nissan: 500,
  infiniti: 638,
  mitsubishi: 535,
  tesla: 832,
};

const MAINTENANCE_FALLBACK = 600; // overall industry average

/** Average annual maintenance + repair cost for a make (national average). */
export function getAnnualMaintenanceCost(make: string | null): number {
  if (!make) return MAINTENANCE_FALLBACK;
  return MAINTENANCE_COST[make.toLowerCase()] ?? MAINTENANCE_FALLBACK;
}

// Approximate annual depreciation rate (fraction of current value lost per year).
const DEPRECIATION_RATE: Record<string, number> = {
  toyota: 0.08,
  lexus: 0.09,
  honda: 0.08,
  acura: 0.1,
  mazda: 0.09,
  subaru: 0.1,
  ford: 0.12,
  lincoln: 0.15,
  chevrolet: 0.12,
  gmc: 0.12,
  buick: 0.13,
  cadillac: 0.16,
  dodge: 0.13,
  ram: 0.12,
  chrysler: 0.14,
  jeep: 0.12,
  bmw: 0.15,
  mercedes: 0.15,
  "mercedes-benz": 0.15,
  audi: 0.14,
  volkswagen: 0.12,
  volvo: 0.14,
  porsche: 0.1,
  hyundai: 0.1,
  genesis: 0.13,
  kia: 0.1,
  nissan: 0.11,
  infiniti: 0.14,
  mitsubishi: 0.11,
  tesla: 0.16,
};

const DEPRECIATION_FALLBACK = 0.12; // typical used-car annual depreciation

/** Annual depreciation rate (fraction lost per year) for a make. */
export function getDepreciationRate(make: string | null): number {
  if (!make) return DEPRECIATION_FALLBACK;
  return DEPRECIATION_RATE[make.toLowerCase()] ?? DEPRECIATION_FALLBACK;
}

/** Projected value after N years of compounding depreciation. */
export function estimateValueInYears(currentPrice: number, make: string | null, years: number): number {
  const rate = getDepreciationRate(make);
  return Math.round(currentPrice * Math.pow(1 - rate, years));
}

// Rough annual insurance estimate by body style (national averages for a full-coverage policy).
function annualInsurance(bodyStyle: string | null): number {
  const b = (bodyStyle ?? "").toLowerCase();
  if (b.includes("convertible") || b.includes("coupe")) return 2400;
  if (b.includes("truck") || b.includes("suv") || b.includes("van")) return 1900;
  return 1600; // sedan / hatchback / wagon / default
}

export interface OwnershipEstimate {
  years: number;
  fuelTotal: number;
  maintenanceTotal: number;
  insuranceTotal: number;
  depreciation: number; // price minus projected resale value
  residualValue: number; // projected resale value after `years`
  total: number; // total cost of ownership over the period
  depreciationRate: number; // annual rate, for the resale indicator
}

/**
 * Five-year (default) total cost of ownership. `annualFuelCost` comes from the FuelEconomy.gov
 * enrichment already fetched for the modal; pass null to omit fuel from the estimate.
 */
export function estimateOwnershipCost(opts: {
  price: number;
  make: string | null;
  bodyStyle: string | null;
  annualFuelCost: number | null;
  years?: number;
}): OwnershipEstimate {
  const years = opts.years ?? 5;
  const fuelTotal = (opts.annualFuelCost ?? 0) * years;
  const maintenanceTotal = getAnnualMaintenanceCost(opts.make) * years;
  const insuranceTotal = annualInsurance(opts.bodyStyle) * years;
  const residualValue = estimateValueInYears(opts.price, opts.make, years);
  const depreciation = Math.max(0, opts.price - residualValue);
  const total = depreciation + fuelTotal + maintenanceTotal + insuranceTotal;
  return {
    years,
    fuelTotal,
    maintenanceTotal,
    insuranceTotal,
    depreciation,
    residualValue,
    total,
    depreciationRate: getDepreciationRate(opts.make),
  };
}
