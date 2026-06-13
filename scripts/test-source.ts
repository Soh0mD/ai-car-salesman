/**
 * Manual smoke test for the data layer. Run with Node 24 (native TS) + env file:
 *
 *   node --env-file=.env.local scripts/test-source.ts
 *
 * - NHTSA recall + VIN decode hit the live (free, keyless) API, so they prove that
 *   reliability-enrichment path end to end with no setup.
 * - aggregate() exercises the full pipeline; sources with no key return [] gracefully.
 */
import { getRecallCount, decodeVin } from "../lib/nhtsa.ts";
import { aggregate } from "../lib/aggregate.ts";
import type { SearchPlan } from "../lib/types.ts";

const samplePlan: SearchPlan = {
  conversational_reply: "test",
  constraints: {
    budget_max: 25000,
    zip_code: "46202",
    radius_miles: 50,
    min_seating_capacity: 5,
    fuel_efficiency_priority: "high",
    intended_use: "daily_commute_and_family",
  },
  automotive_targets: {
    body_styles: ["SUV"],
    excluded_body_styles: ["Minivan"],
    suggested_models: [
      { make: "Toyota", model: "RAV4", years: { min: 2018, max: 2022 } },
      { make: "Honda", model: "CR-V", years: { min: 2017, max: 2021 } },
    ],
    mechanical_filters: {
      reliability_tier: "highest",
      preferred_drivetrains: ["AWD", "FWD"],
      excluded_powertrains: [],
    },
  },
};

async function main() {
  console.log("== NHTSA recall counts (live) ==");
  console.log("Honda CR-V 2018:", await getRecallCount("Honda", "CR-V", 2018));
  console.log("Ford Focus 2014:", await getRecallCount("Ford", "Focus", 2014));

  console.log("\n== NHTSA VIN decode (live) ==");
  console.log(await decodeVin("1HGCM82633A004352"));

  console.log("\n== Full aggregate pipeline ==");
  const { listings, counts } = await aggregate(samplePlan);
  console.log("per-source counts:", counts);
  console.log("merged+ranked listings:", listings.length);
  const nulls = listings.filter((l) => l.recall_count === null).length;
  console.log(`recall_count null: ${nulls} of ${listings.length}`);
  for (const l of listings.slice(0, 4)) {
    console.log(`  [${l.source}] ${l.title} | $${l.price} | recalls=${l.recall_count} | score=${l.value_score}`);
  }
  const top = listings[0];
  console.log("\n== direct probe of top listing's exact fields ==");
  console.log(`make=${JSON.stringify(top?.make)} model=${JSON.stringify(top?.model)} year=${JSON.stringify(top?.year)}`);
  if (top?.make && top?.model && top?.year) {
    console.log("direct getRecallCount ->", await getRecallCount(top.make, top.model, top.year));
  }
  console.log("(any source with no key configured returns 0 — pipeline still runs)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
