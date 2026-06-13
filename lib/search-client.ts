import type { NormalizedListing, WizardProfile } from "./types";

/** Client-side SSE consumption shared by the wizard results and the advanced chat. */

export interface SearchCallbacks {
  onReplyDelta: (text: string) => void;
  onListings: (
    listings: NormalizedListing[],
    counts: Record<string, number>,
    enriched: boolean,
  ) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

async function consume(res: Response, cb: SearchCallbacks): Promise<void> {
  if (!res.ok || !res.body) {
    cb.onError(
      res.status === 429
        ? "You're searching too fast — give it a minute."
        : `Request failed (${res.status}).`,
    );
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const ev = block.match(/^event: (.*)$/m)?.[1];
      const dataRaw = block.match(/^data: (.*)$/m)?.[1];
      if (!ev || !dataRaw) continue;
      const data = JSON.parse(dataRaw);
      switch (ev) {
        case "reply_delta":
          cb.onReplyDelta(data.text as string);
          break;
        case "listings":
          cb.onListings(
            (data.listings as NormalizedListing[]) ?? [],
            (data.counts as Record<string, number>) ?? {},
            !!data.enriched,
          );
          break;
        case "error":
          cb.onError(data.message as string);
          break;
        case "done":
          cb.onDone();
          break;
      }
    }
  }
}

export async function runWizardSearch(profile: WizardProfile, cb: SearchCallbacks): Promise<void> {
  try {
    const res = await fetch("/api/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    await consume(res, cb);
  } catch {
    cb.onError("Connection lost. Try again.");
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function runChatSearch(messages: ChatMessage[], cb: SearchCallbacks): Promise<void> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    await consume(res, cb);
  } catch {
    cb.onError("Connection lost. Try again.");
  }
}
