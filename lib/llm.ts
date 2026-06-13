import Anthropic from "@anthropic-ai/sdk";
import { searchPlanSchema, type SearchPlan } from "./types";

/**
 * The conversational brain. Ingests unstructured user needs and maps them to a strict
 * SearchPlan via Anthropic tool-use. Tool-use is used instead of "respond only in JSON"
 * prose because it guarantees schema-valid output without parsing hacks.
 */

// Sonnet 4.6 is the sweet spot for structured extraction: fast, cheap, reliable JSON.
// (`claude-4.7-opus` from the original spec does not exist.)
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an expert automotive advisor and master mechanic helping a real person find a used car. You translate fuzzy, emotional, non-expert descriptions of needs into a precise, machine-readable search plan, AND you give honest, grounded buying advice.

DOMAIN RULES — apply these proactively, the user will not know to ask:
- Map life situations to hard constraints. "3 kids" / "family" -> min_seating_capacity >= 5 (often 6-7 if 3+ kids need car seats; use judgment). "good mileage" / "commute" -> fuel_efficiency_priority "high".
- Map dislikes to exclusions. "hate minivans" -> excluded_body_styles includes "Minivan". Respect these strictly.
- Map a US city/region to a representative zip_code (e.g. "Indy"/"Indianapolis" -> "46202"). Default radius_miles to 50 if the user implies local but gives no radius.
- RELIABILITY: when the user signals a tight budget AND wants reliability/low-maintenance, populate mechanical_filters.excluded_powertrains with genuinely failure-prone drivetrains to steer away from, e.g.: early Nissan/Jatco CVTs (2013-2017 Altima/Sentra/Pathfinder), dry-clutch dual-clutch transmissions (e.g. Ford Powershift 2012-2016 Fiesta/Focus), Hyundai/Kia Theta II 2.0T/2.4 GDI engines (rod-knock recall era), early Mini/BMW N20/N14 timing chains. Only include ones relevant to the user's segment.
- suggested_models: recommend 3-6 specific make/model/year-range combos that genuinely fit. Favor models with strong reliability track records when reliability is a priority (e.g. Toyota RAV4, Honda CR-V, Mazda CX-5, Toyota Camry, Honda Accord, Toyota Highlander, Subaru Forester). Set realistic year ranges that fit the budget.
- reliability_tier: "highest" only for the most bulletproof picks; "high" otherwise; "any" if the user doesn't care.

conversational_reply: Write a warm, concise (2-5 sentence) message to the user. Explain WHAT you're searching for and WHY (mention 1-2 standout picks and any powertrain you're steering them away from and why). Do NOT dump JSON or bullet schemas into this field — it is spoken to a human. Do not over-promise; you are about to search live inventory.

Always call the build_search_plan tool. Never respond without it.`;

// Hand-written JSON Schema for the tool input (kept in sync with searchPlanSchema).
const SEARCH_PLAN_TOOL: Anthropic.Tool = {
  name: "build_search_plan",
  description:
    "Produce the conversational reply plus the structured search plan used to query live car inventory.",
  input_schema: {
    type: "object",
    properties: {
      conversational_reply: {
        type: "string",
        description: "Human-facing chat message. Advice + why these picks. No JSON.",
      },
      constraints: {
        type: "object",
        properties: {
          budget_max: { type: ["number", "null"] },
          budget_min: { type: ["number", "null"] },
          zip_code: { type: ["string", "null"] },
          radius_miles: { type: ["number", "null"] },
          min_seating_capacity: { type: ["number", "null"] },
          fuel_efficiency_priority: {
            type: ["string", "null"],
            enum: ["low", "medium", "high", null],
          },
          intended_use: { type: ["string", "null"] },
        },
        required: [],
      },
      automotive_targets: {
        type: "object",
        properties: {
          body_styles: { type: "array", items: { type: "string" } },
          excluded_body_styles: { type: "array", items: { type: "string" } },
          suggested_models: {
            type: "array",
            items: {
              type: "object",
              properties: {
                make: { type: "string" },
                model: { type: "string" },
                years: {
                  type: "object",
                  properties: {
                    min: { type: "number" },
                    max: { type: "number" },
                  },
                  required: ["min", "max"],
                },
              },
              required: ["make", "model", "years"],
            },
          },
          mechanical_filters: {
            type: "object",
            properties: {
              reliability_tier: {
                type: ["string", "null"],
                enum: ["any", "high", "highest", null],
              },
              preferred_drivetrains: { type: "array", items: { type: "string" } },
              excluded_powertrains: { type: "array", items: { type: "string" } },
            },
            required: [],
          },
        },
        required: ["body_styles", "suggested_models", "mechanical_filters"],
      },
    },
    required: ["conversational_reply", "constraints", "automotive_targets"],
  },
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
  }
  cachedClient ??= new Anthropic({ apiKey });
  return cachedClient;
}

/**
 * Run the conversational brain over the chat history and return a validated SearchPlan.
 * Only the conversational layer ever sees raw history; downstream inventory APIs receive
 * the distilled constraints (see lib/aggregate.ts).
 */
export async function buildSearchPlan(messages: ChatMessage[]): Promise<SearchPlan> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [SEARCH_PLAN_TOOL],
    tool_choice: { type: "tool", name: SEARCH_PLAN_TOOL.name },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Model did not return a build_search_plan tool call.");
  }

  // zod validates + applies defaults; throws on a malformed payload (defensive parsing).
  return searchPlanSchema.parse(toolUse.input);
}
