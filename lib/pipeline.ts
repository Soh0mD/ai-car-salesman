import { streamReplyAndPlan, extractSearchPlan, type ChatMessage } from "./llm";
import { searchAndRank, enrichListings } from "./aggregate";
import type { NormalizedListing, SearchPlan, WizardProfile } from "./types";

/**
 * Shared conversational-search pipeline used by both the chat route (free text) and the
 * wizard route (structured profile). Streams the reply, extracts a plan, optionally forces
 * the wizard's explicit values onto it, then delivers listings progressively.
 */

export type SendFn = (event: string, data: unknown) => void;

/** Build a text/event-stream Response, running `run` with a `send` helper. Errors -> error event. */
export function sseResponse(run: (send: SendFn) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: SendFn = (event, data) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        await run(send);
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export interface SearchResult {
  replyText: string;
  listings: NormalizedListing[];
  counts: Record<string, number>;
}

/** Compose a natural-language brief from the structured wizard profile (for the LLM). */
export function briefFromProfile(p: WizardProfile): string {
  const useText: Record<WizardProfile["primary_use"], string> = {
    commute: "daily commuting",
    family: "hauling the family",
    fun: "weekend fun and enjoyment",
    first_car: "a first car for a new driver",
    work: "work and utility",
  };
  return [
    `I'm shopping for a used car, mainly for ${useText[p.primary_use]}.`,
    `My budget is up to $${p.budget_max.toLocaleString()}.`,
    p.radius_miles >= 99999
      ? `I'm near ZIP ${p.zip_code} but will consider cars nationwide.`
      : `I'm near ZIP ${p.zip_code}, within about ${p.radius_miles} miles.`,
    p.seats ? `I need at least ${p.seats} seats.` : "",
    `I'd consider model years ${p.year_min}-${p.year_max}, up to ${p.max_mileage.toLocaleString()} miles.`,
    `Fuel efficiency priority is ${p.fuel_priority}.`,
    `On a 1-5 scale, safety matters ${p.safety}/5 and fun-to-drive matters ${p.fun}/5.`,
    p.drivetrain !== "any" ? `I want ${p.drivetrain.toUpperCase()} drivetrain.` : "",
    p.transmission !== "any" ? `I want a ${p.transmission} transmission.` : "",
    (p.fuels ?? []).length ? `Fuel type(s): ${p.fuels.join(", ")}.` : "",
    p.cylinders ? `${p.cylinders} cylinders.` : "",
    p.keywords.trim() ? `Must mention: ${p.keywords.trim()}.` : "",
    p.body_styles.length ? `Preferred body styles: ${p.body_styles.join(", ")}.` : "",
    p.excluded_body_styles.length ? `Do not include: ${p.excluded_body_styles.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Force the wizard's explicit values onto the LLM-extracted plan (guarantees repeatability). */
function applyProfileOverrides(plan: SearchPlan, p: WizardProfile): void {
  Object.assign(plan.constraints, {
    budget_max: p.budget_max,
    zip_code: p.zip_code,
    radius_miles: p.radius_miles,
    min_seating_capacity: p.seats || null,
    fuel_efficiency_priority: p.fuel_priority,
    max_mileage: p.max_mileage,
    year_min: p.year_min,
    year_max: p.year_max,
    transmission: p.transmission === "any" ? null : p.transmission,
    // Single fuel_type lets the source pre-filter (electric/diesel) when exactly one is chosen;
    // fuel_types drives the multi-aware post-filter. Empty selection = any.
    fuel_type: (p.fuels ?? []).length === 1 ? (p.fuels[0] as "gas" | "hybrid" | "electric" | "diesel") : null,
    fuel_types: (p.fuels ?? []).length
      ? (p.fuels as ("gas" | "hybrid" | "electric" | "diesel")[])
      : null,
    cylinders: p.cylinders || null,
    keywords: p.keywords.trim() || null,
  });
  // Drivetrain preference: AWD and 4WD are now distinct (the user asked to separate them).
  // 4WD also accepts the "4x4" label some feeds use; FWD/RWD/AWD are matched on their own token.
  // ALWAYS set from the wizard (authoritative) — "any" must CLEAR any drivetrain the LLM inferred,
  // otherwise an inferred value silently over-filters when the user asked for no preference.
  const driveMap: Record<WizardProfile["drivetrain"], string[]> = {
    any: [],
    awd: ["AWD"],
    "4wd": ["4WD", "4x4"],
    fwd: ["FWD"],
    rwd: ["RWD"],
  };
  plan.automotive_targets.mechanical_filters.preferred_drivetrains = driveMap[p.drivetrain];
  if (p.body_styles.length) plan.automotive_targets.body_styles = p.body_styles;
  if (p.excluded_body_styles.length) {
    plan.automotive_targets.excluded_body_styles = [
      ...new Set([...plan.automotive_targets.excluded_body_styles, ...p.excluded_body_styles]),
    ];
  }
  // Clamp each suggested model's year window to the wizard's accepted range.
  plan.automotive_targets.suggested_models = plan.automotive_targets.suggested_models
    .map((m) => ({
      ...m,
      years: { min: Math.max(m.years.min, p.year_min), max: Math.min(m.years.max, p.year_max) },
    }))
    .filter((m) => m.years.min <= m.years.max);
}

/** Build the deterministic search plan for a wizard profile (extract + force overrides). */
export async function buildPlanForProfile(profile: WizardProfile): Promise<SearchPlan> {
  const messages = [{ role: "user" as const, content: briefFromProfile(profile) }];
  const plan = await extractSearchPlan(messages);
  applyProfileOverrides(plan, profile);
  return plan;
}

/** Non-streaming search for a profile (used by the saved-search alert cron). No enrichment. */
export async function searchForProfile(profile: WizardProfile): Promise<NormalizedListing[]> {
  const plan = await buildPlanForProfile(profile);
  const { listings } = await searchAndRank(plan);
  return listings;
}

export async function runConversationalSearch(
  messages: ChatMessage[],
  send: SendFn,
  profile?: WizardProfile,
): Promise<SearchResult> {
  // One streaming call yields both the prose reply (streamed via reply_delta) and the search plan.
  // Best-effort: if the call fails we still try to recover a plan so listings can be delivered.
  const { replyText, plan: streamedPlan } = await streamReplyAndPlan(messages, (delta) =>
    send("reply_delta", { text: delta }),
  ).catch((err) => {
    console.error("reply+plan stream failed:", err);
    return { replyText: "", plan: null };
  });
  // Rare fallback: model returned prose but no (valid) tool call -> a forced extraction guarantees one.
  const plan = streamedPlan ?? (await extractSearchPlan(messages));
  if (profile) applyProfileOverrides(plan, profile);
  send("plan", { constraints: plan.constraints, targets: plan.automotive_targets });

  // Progressive delivery: fast cards first, then the same set enriched with NHTSA data.
  const { listings, counts } = await searchAndRank(plan);
  send("listings", { listings, counts, enriched: false });

  await enrichListings(listings, plan);
  send("listings", { listings, counts, enriched: true });

  return { replyText, listings, counts };
}
