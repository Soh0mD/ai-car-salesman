"use client";

import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { NormalizedListing } from "@/lib/types";
import { runChatSearch, type ChatMessage } from "@/lib/search-client";
import { ResultsList } from "./ResultsList";
import { DetailModal } from "./DetailModal";

export function Chat({ onHome }: { onHome: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [listings, setListings] = useState<NormalizedListing[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NormalizedListing | null>(null);
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
        <h1 className="md-title">Describe it yourself</h1>
        <button onClick={onHome} className="md-btn md-btn-text text-sm">
          ← Home
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
            Tell me what you need — e.g. &quot;reliable AWD SUV for snowy commutes near Indy,
            under $22k&quot;.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className="max-w-[85%] rounded-3xl px-4 py-2.5 text-sm"
              style={
                m.role === "user"
                  ? { background: "var(--md-primary)", color: "var(--md-on-primary)" }
                  : {
                      background: "var(--md-surface-container-high)",
                      color: "var(--md-on-surface)",
                    }
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {error && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{
              background: "var(--md-error-container)",
              color: "var(--md-on-error-container)",
            }}
          >
            {error}
          </div>
        )}

        <ResultsList
          listings={listings}
          counts={counts}
          reliabilityLoading={reliabilityLoading}
          onSelect={setSelected}
        />
      </div>

      <AnimatePresence>
        {selected && <DetailModal listing={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

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
          className="md-field flex-1 text-sm"
        />
        <button type="submit" disabled={busy || !input.trim()} className="md-btn md-btn-filled">
          {busy ? "…" : "Search"}
        </button>
      </form>
    </main>
  );
}
