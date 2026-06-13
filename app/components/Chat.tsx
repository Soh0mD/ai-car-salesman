"use client";

import { useRef, useState } from "react";
import type { NormalizedListing } from "@/lib/types";
import { runChatSearch, type ChatMessage } from "@/lib/search-client";
import { ResultsList } from "./ResultsList";

export function Chat({ onHome }: { onHome: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [listings, setListings] = useState<NormalizedListing[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function submit(text: string) {
    const query = text.trim();
    if (!query || busy) return;
    setError(null);
    setListings([]);
    setCounts(null);
    setReliabilityLoading(false);
    const next: ChatMessage[] = [...messages, { role: "user", content: query }];
    setMessages(next);
    setInput("");
    setBusy(true);

    await runChatSearch(next, {
      onReplyDelta: (delta) =>
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last?.role === "assistant") {
            return [...m.slice(0, -1), { ...last, content: last.content + delta }];
          }
          return [...m, { role: "assistant", content: delta }];
        }),
      onListings: (l, c, enriched) => {
        setListings(l);
        setCounts(c);
        setReliabilityLoading(!enriched);
      },
      onError: setError,
      onDone: () => {},
    });
    setBusy(false);
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Describe it yourself</h1>
        <button
          onClick={onHome}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          ← Home
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            Tell me what you need — e.g. &quot;reliable AWD SUV for snowy commutes near Indy,
            under $22k&quot;.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm text-white"
                  : "max-w-[85%] rounded-2xl bg-white px-4 py-2.5 text-sm shadow-sm dark:bg-neutral-900"
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <ResultsList listings={listings} counts={counts} reliabilityLoading={reliabilityLoading} />
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
          placeholder="What are you looking for?"
          disabled={busy}
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40"
        >
          {busy ? "…" : "Search"}
        </button>
      </form>
    </main>
  );
}
