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
];

// "avoid" before "caution" so the more serious flag wins when a make has overlapping rules.
const ORDERED = [...RULES].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "avoid" ? -1 : 1));

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
    if (r.models && !r.models.some((m) => md.includes(m.toLowerCase()))) continue;
    return { severity: r.severity, issue: r.issue };
  }
  return null;
}
