import type { ReliabilityFlag, ReliabilitySeverity } from "./types";

/**
 * Curated, deterministic reliability rules — a backstop to the LLM's contextual judgment.
 * These match a listing's exact make/model/year, so the most notorious failure-prone
 * powertrains are GUARANTEED to surface (with a real reason) regardless of how the model
 * reasons on a given turn. This complements the live NHTSA recall lookup in lib/nhtsa.ts.
 *
 * "avoid"   = expensive/catastrophic and well-documented (heavy score penalty).
 * "caution" = real but often preventable/serviceable; worth verifying before buying.
 *
 * Not exhaustive — it's the "famous offenders" set. Keep entries defensible and specific.
 */

interface Rule {
  make: string; // exact, case-insensitive
  models?: string[]; // case-insensitive substrings of the listing's model; omit = any model
  excludeModels?: string[]; // case-insensitive substrings that DISQUALIFY (e.g. "Grand Cherokee" vs "Cherokee")
  yearMin: number;
  yearMax: number;
  severity: ReliabilitySeverity;
  issue: string;
}

const RULES: Rule[] = [
  {
    make: "Nissan",
    models: ["Altima", "Sentra", "Pathfinder", "Rogue", "Murano", "Versa", "Maxima", "Quest", "JX"],
    yearMin: 2013,
    yearMax: 2018,
    severity: "avoid",
    issue: "Nissan/Jatco CVT — well-documented premature transmission failure, costly to replace",
  },
  {
    make: "Ford",
    models: ["Focus", "Fiesta"],
    yearMin: 2011,
    yearMax: 2016,
    severity: "avoid",
    issue: "Ford PowerShift dry-clutch automatic — chronic shuddering and clutch failure (class action)",
  },
  {
    make: "Hyundai",
    models: ["Sonata", "Santa Fe", "Tucson"],
    yearMin: 2011,
    yearMax: 2019,
    severity: "avoid",
    issue: "Theta II 2.0T/2.4 GDI engine — rod-knock/seizure and engine-fire recall history",
  },
  {
    make: "Kia",
    models: ["Optima", "Sorento", "Sportage"],
    yearMin: 2011,
    yearMax: 2019,
    severity: "avoid",
    issue: "Theta II 2.0T/2.4 GDI engine — rod-knock/seizure and engine-fire recall history",
  },
  {
    make: "BMW",
    models: ["550", "650", "750", "X5", "X6"],
    yearMin: 2009,
    yearMax: 2013,
    severity: "avoid",
    issue: "N63 twin-turbo V8 — heavy oil consumption, turbo and valve-stem issues; very costly",
  },
  {
    make: "BMW",
    models: ["320", "328", "428", "528", "228", "X1", "X3", "X4", "Z4"],
    yearMin: 2012,
    yearMax: 2015,
    severity: "caution",
    issue: "N20/N26 turbo-4 — timing chain guide wear; confirm chain service history",
  },
  {
    make: "Volkswagen",
    models: ["GTI", "Jetta", "Passat", "Tiguan", "CC", "Golf", "Beetle", "Eos"],
    yearMin: 2008,
    yearMax: 2014,
    severity: "caution",
    issue: "2.0T (EA888 Gen2) — timing chain tensioner failure; verify it's the updated part",
  },
  {
    make: "Audi",
    models: ["A3", "A4", "A5", "Q5", "TT", "A6"],
    yearMin: 2008,
    yearMax: 2014,
    severity: "caution",
    issue: "2.0T (EA888 Gen2) — timing chain tensioner failure and oil consumption",
  },
  {
    make: "Chevrolet",
    models: ["Equinox", "Malibu", "Captiva"],
    yearMin: 2010,
    yearMax: 2017,
    severity: "caution",
    issue: "2.4L Ecotec — excessive oil consumption (piston rings) and timing chain wear",
  },
  {
    make: "GMC",
    models: ["Terrain"],
    yearMin: 2010,
    yearMax: 2017,
    severity: "caution",
    issue: "2.4L Ecotec — excessive oil consumption (piston rings) and timing chain wear",
  },
  {
    make: "Jeep",
    models: ["Cherokee", "Renegade", "Compass"],
    excludeModels: ["Grand Cherokee"], // Grand Cherokee uses the Pentastar V6/HEMI, not the 2.4
    yearMin: 2014,
    yearMax: 2020,
    severity: "caution",
    issue: "2.4L Tigershark MultiAir — excessive oil consumption; early ZF 9-spd shifting quirks",
  },
  {
    make: "Honda",
    models: ["CR-V", "Civic", "Accord"],
    yearMin: 2016,
    yearMax: 2019,
    severity: "caution",
    issue: "1.5T trims — fuel/oil dilution in cold climates; fine if it's the 2.4L or has the TSB",
  },
  {
    make: "Subaru",
    models: ["Forester", "Impreza", "Crosstrek", "Outback", "Legacy"],
    yearMin: 2011,
    yearMax: 2014,
    severity: "caution",
    issue: "2.5L (FB25) — excessive oil consumption (piston-ring TSB era)",
  },

  // ── Additional documented offenders ──────────────────────────────────────────────────────
  // Sourced the same way as the entries above: NHTSA recalls/investigations, class-action
  // settlements, manufacturer TSBs / warranty extensions, and long-standing, widely-reported
  // failure patterns. Kept specific to engine/drivetrain + year range to stay defensible.
  {
    make: "Subaru",
    models: ["Outback", "Legacy", "Forester", "Impreza", "Baja"],
    yearMin: 2000,
    yearMax: 2009,
    severity: "caution",
    issue: "EJ25 (SOHC) — head-gasket leaks are common with age/mileage; budget for the repair",
  },
  {
    make: "Ford",
    models: ["F-250", "F-350", "F-450", "Excursion"],
    yearMin: 2003,
    yearMax: 2007,
    severity: "avoid",
    issue: "6.0L Power Stroke diesel — notorious EGR cooler / oil cooler / head-gasket failures; very costly unless already bulletproofed",
  },
  {
    make: "Ford",
    models: ["F-150", "Expedition", "F-250", "F-350"],
    yearMin: 2004,
    yearMax: 2010,
    severity: "caution",
    issue: "5.4L 3-valve Triton V8 — spark-plug breakage/blowout and cam-phaser rattle; confirm the fixes were done",
  },
  {
    make: "Lincoln",
    models: ["Navigator", "Mark LT"],
    yearMin: 2005,
    yearMax: 2010,
    severity: "caution",
    issue: "5.4L 3-valve Triton V8 — spark-plug breakage/blowout and cam-phaser rattle",
  },
  {
    make: "Ford",
    models: ["Escape", "Fusion"],
    yearMin: 2013,
    yearMax: 2014,
    severity: "caution",
    issue: "1.6L EcoBoost — coolant intrusion into the cylinders and engine-fire recall history",
  },
  {
    make: "Chevrolet",
    models: ["Silverado", "Tahoe", "Suburban", "Avalanche"],
    yearMin: 2010,
    yearMax: 2014,
    severity: "caution",
    issue: "5.3L V8 (Gen IV, Active Fuel Management) — oil consumption and AFM lifter failure; check for a clean cold start",
  },
  {
    make: "GMC",
    models: ["Sierra", "Yukon"],
    yearMin: 2010,
    yearMax: 2014,
    severity: "caution",
    issue: "5.3L V8 (Gen IV, Active Fuel Management) — oil consumption and AFM lifter failure; check for a clean cold start",
  },
  {
    make: "Chevrolet",
    models: ["Cruze", "Sonic", "Trax"],
    yearMin: 2011,
    yearMax: 2016,
    severity: "caution",
    issue: "1.4L turbo — coolant leaks and PCV / valve-cover failures; watch for unexplained coolant loss",
  },
  {
    make: "BMW",
    models: ["135", "335", "535", "740", "1M", "Z4"],
    yearMin: 2007,
    yearMax: 2011,
    severity: "caution",
    issue: "N54 twin-turbo — high-pressure fuel pump and wastegate failures (HPFP recall / extended-warranty era)",
  },
  {
    make: "MINI",
    models: ["Cooper"],
    yearMin: 2007,
    yearMax: 2010,
    severity: "caution",
    issue: "N14 turbo (Cooper S) — timing-chain rattle, carbon buildup, and turbo / water-pump failures",
  },
  {
    make: "Mazda",
    models: ["CX-7", "Mazdaspeed", "Speed3", "Speed6"],
    yearMin: 2006,
    yearMax: 2012,
    severity: "caution",
    issue: "2.3L DISI turbo — turbo and timing-chain / VVT wear; CX-7 especially demands diligent oil changes",
  },
  {
    make: "Honda",
    models: ["Odyssey", "Pilot", "Ridgeline", "Accord"],
    yearMin: 2008,
    yearMax: 2013,
    severity: "caution",
    issue: "3.5L V6 with VCM — oil consumption from cylinder deactivation plus failure-prone motor mounts",
  },
  {
    make: "Toyota",
    models: ["Camry", "RAV4", "Highlander", "Scion tC", "Solara", "Matrix"],
    yearMin: 2007,
    yearMax: 2011,
    severity: "caution",
    issue: "2.4L 2AZ-FE — piston-ring oil consumption (warranty-extension TSB); check the oil level and for burning",
  },
  {
    make: "Mercedes-Benz",
    models: ["C300", "C350", "E350", "ML350", "CLK350", "SLK350", "R350", "GLK"],
    yearMin: 2005,
    yearMax: 2008,
    severity: "caution",
    issue: "M272 V6 / M273 V8 — balance-shaft / idler-gear wear on early (pre-facelift) engines",
  },
  {
    make: "Jeep",
    models: ["Wrangler", "Grand Cherokee"],
    yearMin: 2011,
    yearMax: 2013,
    severity: "caution",
    issue: "3.6 Pentastar (early build) — left cylinder-head failure causing a cylinder-2 misfire (TSB / extended warranty)",
  },
  {
    make: "Dodge",
    models: ["Charger", "Challenger", "Durango"],
    yearMin: 2011,
    yearMax: 2013,
    severity: "caution",
    issue: "3.6 Pentastar (early build) — left cylinder-head failure causing a cylinder-2 misfire (TSB / extended warranty)",
  },
  {
    make: "Chrysler",
    models: ["300", "Town & Country"],
    yearMin: 2011,
    yearMax: 2013,
    severity: "caution",
    issue: "3.6 Pentastar (early build) — left cylinder-head failure causing a cylinder-2 misfire (TSB / extended warranty)",
  },
  {
    make: "Chrysler",
    models: ["Sebring", "200"],
    yearMin: 2007,
    yearMax: 2010,
    severity: "caution",
    issue: "2.7L V6 — prone to oil sludge and bottom-end failure if oil changes were ever neglected",
  },
  {
    make: "Land Rover",
    models: ["LR3", "LR4", "Range Rover", "Discovery", "Evoque"],
    yearMin: 2005,
    yearMax: 2016,
    severity: "caution",
    issue: "Air-suspension, electrical and cooling repairs are common and expensive across this era — budget accordingly",
  },
];

// "avoid" before "caution" so the more serious flag wins when a make has overlapping rules.
const ORDERED = [...RULES].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "avoid" ? -1 : 1));

// ---- SEO reliability guides (app/reliability) ----------------------------------------------
// Each curated rule doubles as a static, indexable buyer's guide — unique editorial content
// built entirely from local data (zero inventory-API quota).

export interface ReliabilityGuide {
  slug: string;
  make: string;
  models: string[]; // empty = applies across the make's lineup for these years
  yearMin: number;
  yearMax: number;
  severity: ReliabilitySeverity;
  issue: string;
}

const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** All curated rules as guide entries with stable, unique slugs (first model anchors the slug). */
export function getReliabilityGuides(): ReliabilityGuide[] {
  return RULES.map((r) => ({
    slug: `${kebab(r.make)}-${kebab(r.models?.[0] ?? "all-models")}-${r.yearMin}-${r.yearMax}`,
    make: r.make,
    models: r.models ?? [],
    yearMin: r.yearMin,
    yearMax: r.yearMax,
    severity: r.severity,
    issue: r.issue,
  }));
}

export function getGuideBySlug(slug: string): ReliabilityGuide | null {
  return getReliabilityGuides().find((g) => g.slug === slug) ?? null;
}

/** Match a listing's make/model/year against the curated rules. Returns the first/worst hit. */
export function checkReliability(
  make: string | null,
  model: string | null,
  year: number | null,
): ReliabilityFlag | null {
  if (!make || !model || !year) return null;
  const mk = make.toLowerCase();
  const md = model.toLowerCase();
  for (const r of ORDERED) {
    if (r.make.toLowerCase() !== mk) continue;
    if (year < r.yearMin || year > r.yearMax) continue;
    if (r.excludeModels && r.excludeModels.some((m) => md.includes(m.toLowerCase()))) continue;
    if (r.models && !r.models.some((m) => md.includes(m.toLowerCase()))) continue;
    return { severity: r.severity, issue: r.issue };
  }
  return null;
}
