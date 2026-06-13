import Anthropic from "@anthropic-ai/sdk";
import { searchPlanSchema, type SearchPlan } from "./types";

/**
 * The conversational brain, split into two concurrent concerns for fast perceived latency:
 *  1. streamConversationalReply() — streams warm, plain-text advice token-by-token so the user
 *     sees a response in ~1-2s instead of waiting for the whole turn.
 *  2. extractSearchPlan() — tool-use call that distills the request into a strict SearchPlan.
 * The route fires both at once (see app/api/chat/route.ts); only the distilled plan goes
 * downstream to the inventory APIs.
 */

// Sonnet 4.6 is the sweet spot here: fast, cheap, reliable JSON.
// (`claude-4.7-opus` from the original spec does not exist.)
const MODEL = "claude-sonnet-4-6";

// Shared domain knowledge, used by both calls so the advice and the search stay consistent.
const DOMAIN_RULES = `DOMAIN RULES — apply these proactively, the user will not know to ask:
- Map life situations to needs: "3 kids" / "family" -> needs 5+ seats (often 6-7 with car seats). "good mileage" / "commute" -> prioritize fuel efficiency.
- Respect dislikes strictly: "hate minivans" -> exclude minivans.
- Map a US city/region to its area (e.g. "Indy" -> Indianapolis, zip ~46202), default ~50 mile radius if local.
- RELIABILITY: when budget is tight AND reliability matters, steer away from genuinely failure-prone drivetrains relevant to the segment, e.g. early Nissan/Jatco CVTs (2013-2017 Altima/Sentra/Pathfinder), dry-clutch DCTs (Ford PowerShift 2012-2016 Fiesta/Focus), Hyundai/Kia Theta II 2.0T/2.4 GDI (rod-knock era), early BMW N20 timing chains.
- Favor strong-reliability picks when reliability is a priority (Toyota RAV4/Camry/Highlander, Honda CR-V/Accord, Mazda CX-5, Subaru Forester).`;

const REPLY_SYSTEM_PROMPT = `You are an expert automotive advisor and master mechanic helping a real person find a used car, speaking warmly and concisely.

${DOMAIN_RULES}

Write a warm, concise (2-4 sentence) reply spoken directly to the user. Explain WHAT you're about to search for and WHY — name 1-2 standout picks and call out any powertrain you're steering them away from and the reason. Plain prose only: no JSON, no bullet lists, no headers. Don't over-promise; you're about to search live inventory.`;

const EXTRACT_SYSTEM_PROMPT = `You convert a person's used-car needs into a precise, machine-readable search plan by calling the build_search_plan tool.

${DOMAIN_RULES}

Tool field guidance:
- min_seating_capacity, fuel_efficiency_priority ("low"/"medium"/"high"), zip_code, radius_miles, budget_max from the request.
- excluded_body_styles: e.g. "Minivan" when disliked.
- suggested_models: 3-6 specific make/model/year-range combos that genuinely fit and fit the budget.
- mechanical_filters.excluded_powertrains: failure-prone drivetrains relevant to this segment.
- reliability_tier: "highest" only for bulletproof picks, "high" otherwise, "any" if they don't care.

Always call build_search_plan. Never reply with prose.`;

// Hand-written JSON Schema for the tool input (kept in sync with searchPlanSchema).
const SEARCH_PLAN_TOOL: Anthropic.Tool = {
  name: "build_search_plan",
  description: "The structured search plan used to query live car inventory.",
  input_schema: {
    type: "object",
    properties: {
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
    required: ["constraints", "automotive_targets"],
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
 * Stream the conversational reply token-by-token. `onDelta` is called with each text chunk as
 * it arrives; the full assembled text is returned when the stream completes.
 */
export async function streamConversationalReply(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<string> {
  const client = getClient();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 400,
    system: REPLY_SYSTEM_PROMPT,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  stream.on("text", (delta) => onDelta(delta));
  const final = await stream.finalMessage();
  const text = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return text;
}

/**
 * Distill the chat history into a validated SearchPlan via tool-use. Runs concurrently with
 * the streaming reply. Only the resulting constraints/targets go downstream to inventory APIs.
 */
export async function extractSearchPlan(messages: ChatMessage[]): Promise<SearchPlan> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: EXTRACT_SYSTEM_PROMPT,
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
