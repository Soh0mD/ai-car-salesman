"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { NormalizedListing, WizardProfile } from "@/lib/types";
import { runWizardSearch } from "@/lib/search-client";
import { ResultsList } from "./ResultsList";

export function Results({
  profile,
  onRestart,
}: {
  profile: WizardProfile;
  onRestart: () => void;
}) {
  const [reply, setReply] = useState("");
  const [listings, setListings] = useState<NormalizedListing[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guard against StrictMode double-invoke
    started.current = true;
    runWizardSearch(profile, {
      onReplyDelta: (t) => setReply((r) => r + t),
      onListings: (l, c, enriched) => {
        setListings(l);
        setCounts(c);
        setReliabilityLoading(!enriched);
      },
      onError: setError,
      onDone: () => setDone(true),
    });
  }, [profile]);

  const searching = reply.length > 0 && listings.length === 0 && !error && !done;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="mx-auto w-full max-w-2xl px-5 py-8"
    >
      <div className="mb-5 flex items-center justify-between">
        <h1 className="md-headline">Here&apos;s what I found 🔑</h1>
        <button onClick={onRestart} className="md-btn md-btn-tonal">
          Start over
        </button>
      </div>

      <ProfileSummary profile={profile} />

      {/* advice */}
      {reply ? (
        <div
          className="mt-4 rounded-3xl px-5 py-4 text-[15px] leading-relaxed"
          style={{
            background: "var(--md-secondary-container)",
            color: "var(--md-on-secondary-container)",
          }}
        >
          {reply}
          {!done && <span className="ml-0.5 inline-block animate-pulse">▌</span>}
        </div>
      ) : (
        <Loader label="Reading your answers…" />
      )}

      {error && (
        <div
          className="mt-4 rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "var(--md-error-container)",
            color: "var(--md-on-error-container)",
          }}
        >
          {error}
        </div>
      )}

      {searching && <Loader label="Searching live inventory…" />}

      <div className="mt-6">
        <ResultsList listings={listings} counts={counts} reliabilityLoading={reliabilityLoading} />
      </div>

      {done && listings.length === 0 && !error && (
        <p className="mt-6 text-center text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
          No matching listings came back — try widening your budget, radius, or year range.
        </p>
      )}
    </motion.div>
  );
}

function ProfileSummary({ profile: p }: { profile: WizardProfile }) {
  const bits = [
    `$${p.budget_max.toLocaleString()}`,
    `ZIP ${p.zip_code} · ${p.radius_miles}mi`,
    `${p.seats}+ seats`,
    `${p.year_min}–${p.year_max}`,
    `<${(p.max_mileage / 1000).toFixed(0)}k mi`,
    p.drivetrain !== "any" ? p.drivetrain.toUpperCase() : null,
    p.transmission !== "any" ? p.transmission : null,
    ...p.body_styles,
  ].filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {bits.map((b) => (
        <span key={b} className="md-chip" style={{ cursor: "default" }}>
          {b}
        </span>
      ))}
    </div>
  );
}

function Loader({ label }: { label: string }) {
  return (
    <div
      className="mt-4 flex items-center gap-2 text-sm"
      style={{ color: "var(--md-on-surface-variant)" }}
    >
      <span
        className="inline-block h-2.5 w-2.5 animate-pulse rounded-full"
        style={{ background: "var(--md-primary)" }}
      />
      {label}
    </div>
  );
}
