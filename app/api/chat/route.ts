import { NextRequest } from "next/server";
import { buildSearchPlan, type ChatMessage } from "@/lib/llm";
import { aggregate } from "@/lib/aggregate";
import { checkRateLimit, cacheGet, cacheSet, planCacheKey } from "@/lib/limits";
import type { NormalizedListing } from "@/lib/types";

// The Anthropic SDK needs the Node runtime (not edge). SSE works fine on Vercel node functions.
export const runtime = "nodejs";
export const maxDuration = 30;

interface CachedResponse {
  reply: string;
  listings: NormalizedListing[];
  counts: Record<string, number>;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous";
}

export async function POST(req: NextRequest) {
  let messages: ChatMessage[];
  try {
    const body = (await req.json()) as { messages?: ChatMessage[] };
    messages = body.messages ?? [];
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (messages.length === 0) {
    return new Response("No messages provided", { status: 400 });
  }

  // Cost cap #1: per-IP rate limit. Worst case for an abuser is a 429, never a bill.
  if (!(await checkRateLimit(clientIp(req)))) {
    return new Response("Rate limit exceeded. Please slow down.", { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Cost cap #2: cache identical conversations so we never re-bill Claude or the
        // inventory APIs during repeated/duplicate searches. Only distilled data goes
        // downstream — raw history never leaves the conversational layer.
        const cacheKey = planCacheKey({ messages });
        const cached = await cacheGet<CachedResponse>(cacheKey);
        if (cached) {
          send("reply", { text: cached.reply });
          send("listings", { listings: cached.listings, counts: cached.counts, cached: true });
          send("done", {});
          controller.close();
          return;
        }

        // 1) Conversational brain -> validated search plan.
        const plan = await buildSearchPlan(messages);
        send("reply", { text: plan.conversational_reply });
        send("plan", { constraints: plan.constraints, targets: plan.automotive_targets });

        // 2) Concurrent inventory aggregation.
        const { listings, counts } = await aggregate(plan);
        send("listings", { listings, counts, cached: false });

        await cacheSet(cacheKey, {
          reply: plan.conversational_reply,
          listings,
          counts,
        } satisfies CachedResponse);

        send("done", {});
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        send("error", { message });
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
