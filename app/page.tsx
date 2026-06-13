"use client";

import { useRef, useState } from "react";
import type { NormalizedListing } from "@/lib/types";
import { ListingCard } from "./components/ListingCard";

type ChatMessage = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "I have 3 kids, hate minivans, live in Indy, need good mileage, under $25k.",
  "First car for my daughter, max $12k, has to be safe and dead reliable.",
  "Weekend project car, rear-wheel drive, manual, around $20k.",
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [listings, setListings] = useState<NormalizedListing[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [status, setStatus] = useState<"idle" | "thinking" | "searching">("idle");
  const [reliabilityLoading, setReliabilityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function submit(text: string) {
    const query = text.trim();
    if (!query || status !== "idle") return;

    setError(null);
    setListings([]);
    setCounts(null);
    setReliabilityLoading(false);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: query }];
    setMessages(nextMessages);
    setInput("");
    setStatus("thinking");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        setError(
          res.status === 429
            ? "You're searching too fast — give it a minute."
            : `Request failed (${res.status}).`,
        );
        setStatus("idle");
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
          const evMatch = block.match(/^event: (.*)$/m);
          const dataMatch = block.match(/^data: (.*)$/m);
          if (!evMatch || !dataMatch) continue;
          handleEvent(evMatch[1], JSON.parse(dataMatch[1]));
        }
      }
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setStatus("idle");
    }
  }

  function handleEvent(event: string, data: Record<string, unknown>) {
    switch (event) {
      case "reply":
        setMessages((m) => [...m, { role: "assistant", content: data.text as string }]);
        setStatus("searching");
        break;
      case "listings":
        setListings((data.listings as NormalizedListing[]) ?? []);
        setCounts((data.counts as Record<string, number>) ?? null);
        setReliabilityLoading(!(data.enriched as boolean));
        break;
      case "error":
        setError(data.message as string);
        break;
    }
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">🚗 AI Car Salesman</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Describe what you need like you&apos;d tell a friend. Get real, ranked listings — plus the
          reliability advice a search box can&apos;t give you.
        </p>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && (
          <div className="space-y-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => submit(ex)}
                className="block w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-blue-600 px-4 py-2.5 text-sm text-white"
                  : "max-w-[85%] rounded-2xl bg-white px-4 py-2.5 text-sm shadow-sm dark:bg-neutral-900"
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {status === "thinking" && <Thinking label="Understanding your needs…" />}
        {status === "searching" && listings.length === 0 && (
          <Thinking label="Searching live inventory…" />
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {listings.length > 0 && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span className="font-medium">
                {listings.length} matches, best value first
                {reliabilityLoading && (
                  <span className="ml-2 font-normal text-blue-500">
                    · checking recalls &amp; complaints…
                  </span>
                )}
              </span>
              {counts && (
                <span>
                  {Object.entries(counts)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("  ·  ")}
                </span>
              )}
            </div>
            {listings.map((l, i) => (
              <ListingCard key={`${l.listing_url}-${i}`} listing={l} />
            ))}
          </section>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. reliable AWD SUV for snowy commutes, under $22k…"
          disabled={status !== "idle"}
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={status !== "idle" || !input.trim()}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
        >
          Search
        </button>
      </form>
    </main>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      {label}
    </div>
  );
}
