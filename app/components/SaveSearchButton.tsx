"use client";

import { useState } from "react";
import type { WizardProfile } from "@/lib/types";
import { getAnonId } from "@/lib/client-store";

type State = "idle" | "form" | "saving" | "saved" | "unavailable";

/**
 * Save the current search and (optionally) get emailed when new matches appear. Backed by
 * /api/saved-searches, which requires Upstash (storage) + Resend (email) on the server. When
 * those aren't configured the API replies 503 and we show an honest "not available yet" note.
 */
export function SaveSearchButton({ profile }: { profile: WizardProfile }) {
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");

  async function save() {
    setState("saving");
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId: getAnonId(), profile, email: email.trim() || undefined }),
      });
      setState(res.ok ? "saved" : res.status === 503 ? "unavailable" : "idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "saved")
    return (
      <span className="md-chip" style={{ background: "var(--md-primary-container)", color: "var(--md-on-primary-container)", borderColor: "transparent" }}>
        ✓ Search saved{email.trim() ? " · we'll email you" : ""}
      </span>
    );

  if (state === "unavailable")
    return (
      <span className="md-chip" style={{ cursor: "default" }} title="Saved-search alerts need server email/storage configured.">
        🔔 Alerts coming soon
      </span>
    );

  if (state === "form" || state === "saving")
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email (optional)"
          disabled={state === "saving"}
          className="md-field px-2 py-1 text-xs"
          style={{ width: "11rem" }}
        />
        <button type="button" onClick={save} disabled={state === "saving"} className="md-chip" data-selected="true">
          {state === "saving" ? "Saving…" : "Save"}
        </button>
      </span>
    );

  return (
    <button type="button" onClick={() => setState("form")} className="md-chip">
      🔔 Save &amp; alert me
    </button>
  );
}
