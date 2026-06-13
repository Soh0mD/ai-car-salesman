import { NextRequest } from "next/server";
import { streamConversationalReply, extractSearchPlan, type ChatMessage } from "@/lib/llm";
import { searchAndRank, enrichListings } from "@/lib/aggregate";
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
          send("reply_delta", { text: cached.reply });
          send("listings", { listings: cached.listings, counts: cached.counts, enriched: true });
          send("done", {});
          controller.close();
          return;
        }

        // 1) Fire the streaming reply AND the structured extraction concurrently. The reply
        //    streams to the user in ~1-2s while the plan is still being extracted.
        const replyPromise = streamConversationalReply(messages, (delta) =>
          send("reply_delta", { text: delta }),
        );
        const plan = await extractSearchPlan(messages);
        send("plan", { constraints: plan.constraints, targets: plan.automotive_targets });

        // 2) Progressive delivery: show cards as soon as inventory returns, then re-stream
        //    them enriched with NHTSA recall/complaint data (non-blocking for the user).
        const { listings, counts } = await searchAndRank(plan);
        send("listings", { listings, counts, enriched: false });

        await enrichListings(listings, plan); // mutates + re-sorts in place
        send("listings", { listings, counts, enriched: true });

        const replyText = await replyPromise; // usually already resolved by now
        await cacheSet(cacheKey, { reply: replyText, listings, counts } satisfies CachedResponse);

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
