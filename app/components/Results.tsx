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
        <h1 className="text-2xl font-extrabold tracking-tight">Here&apos;s what I found 🔑</h1>
        <button
          onClick={onRestart}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Start over
        </button>
      </div>

      <ProfileSummary profile={profile} />

      {/* advice */}
      {reply ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-5 py-4 text-[15px] leading-relaxed text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
          {reply}
          {!done && <span className="ml-0.5 inline-block animate-pulse">▌</span>}
        </div>
      ) : (
        <Loader label="Reading your answers…" />
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {searching && <Loader label="Searching live inventory…" />}

      <div className="mt-6">
        <ResultsList listings={listings} counts={counts} reliabilityLoading={reliabilityLoading} />
      </div>

      {done && listings.length === 0 && !error && (
        <p className="mt-6 text-center text-sm text-neutral-500">
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
        <span
          key={b}
          className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {b}
        </span>
      ))}
    </div>
  );
}

function Loader({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
      {label}
    </div>
  );
}
