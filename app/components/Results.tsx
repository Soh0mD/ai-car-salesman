"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { NormalizedListing, WizardProfile } from "@/lib/types";
import { runWizardSearch } from "@/lib/search-client";
import { useRecentlyViewed } from "@/lib/client-store";
import { ResultsList } from "./ResultsList";
import { DetailModal } from "./DetailModal";
import { SaveSearchButton } from "./SaveSearchButton";

export function Results({
  profile: initialProfile,
  onRestart,
}: {
  profile: WizardProfile;
  onRestart: () => void;
}) {
  const [profile, setProfile] = useState<WizardProfile>(initialProfile);
  const [reply, setReply] = useState(""); // raw accumulated text
  const [shown, setShown] = useState(""); // smoothly-revealed text (typewriter)
  const targetRef = useRef(""); // latest reply with markdown stripped
  const [listings, setListings] = useState<NormalizedListing[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<NormalizedListing | null>(null);
  const recentlyViewed = useRecentlyViewed();
  const runToken = useRef(0);

  // Kick off a search stream. A monotonically-increasing token guards against a stale stream
  // from a previous search overwriting the latest one. setState happens only in async callbacks.
  const startStream = useCallback((p: WizardProfile, token: number) => {
    runWizardSearch(p, {
      onReplyDelta: (t) => token === runToken.current && setReply((r) => r + t),
      onListings: (l, c, enriched) => {
        if (token !== runToken.current) return;
        setListings(l);
        setCounts(c);
        setReliabilityLoading(!enriched);
      },
      onError: (m) => token === runToken.current && setError(m),
      onDone: () => token === runToken.current && setDone(true),
    });
  }, []);

  // Initial search on mount (state already starts clean, so no reset needed here).
  useEffect(() => {
    startStream(initialProfile, ++runToken.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run with refined constraints: clear current results, then stream the new search.
  const refine = (patch: Partial<WizardProfile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    setReply("");
    setShown("");
    targetRef.current = "";
    setListings([]);
    setCounts(null);
    setReliabilityLoading(false);
    setError(null);
    setDone(false);
    startStream(next, ++runToken.current);
  };

  // Keep the typewriter target in sync with the raw reply, stripped of any stray markdown.
  useEffect(() => {
    targetRef.current = reply.replace(/[*_`]+/g, "");
  }, [reply]);

  // Reveal characters at a steady rate so streaming reads smoothly.
  useEffect(() => {
    const id = setInterval(() => {
      setShown((prev) => {
        const full = targetRef.current;
        if (prev.length >= full.length) return prev;
        const step = Math.max(1, Math.ceil((full.length - prev.length) / 12));
        return full.slice(0, prev.length + step);
      });
    }, 24);
    return () => clearInterval(id);
  }, []);

  const typing = shown.length < reply.replace(/[*_`]+/g, "").length || !done;
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
          {shown}
          {typing && <span className="ml-0.5 inline-block animate-pulse">▌</span>}
        </div>
      ) : (
        <Loader label="Reading your answers…" />
      )}

      {error && (
        <div
          className="mt-4 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--md-error-container)", color: "var(--md-on-error-container)" }}
        >
          {error}
        </div>
      )}

      {searching && <Loader label="Searching live inventory…" />}

      {/* refine + save */}
      {listings.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold" style={{ color: "var(--md-on-surface-variant)" }}>
            Refine:
          </span>
          <RefineChip label="💸 Cheaper" onClick={() => refine({ budget_max: Math.max(3000, Math.round(profile.budget_max * 0.8)) })} />
          <RefineChip
            label="🆕 Newer"
            onClick={() => refine({ year_min: Math.min(profile.year_max, profile.year_min + 3) })}
          />
          <RefineChip label="🛣️ Lower miles" onClick={() => refine({ max_mileage: Math.max(1000, Math.round(profile.max_mileage / 2)) })} />
          {profile.drivetrain !== "awd" && <RefineChip label="❄️ Only AWD" onClick={() => refine({ drivetrain: "awd" })} />}
          {profile.radius_miles < 99999 && <RefineChip label="🌍 Search wider" onClick={() => refine({ radius_miles: 99999 })} />}
          <SaveSearchButton profile={profile} />
        </div>
      )}

      {recentlyViewed.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--md-on-surface-variant)" }}>
            ↩ Recently viewed
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentlyViewed.map((l) => (
              <button
                key={l.vin ?? l.listing_url}
                type="button"
                onClick={() => setSelected(l)}
                className="md-card md-card-outlined md-card-link shrink-0 px-3 py-2 text-left"
                style={{ width: "11rem" }}
              >
                <div className="truncate text-xs font-semibold">{l.title || "Vehicle"}</div>
                <div className="text-xs font-bold" style={{ color: "var(--md-primary)" }}>
                  {l.price != null ? `$${l.price.toLocaleString()}` : "—"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
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

      {done && listings.length === 0 && !error && (
        <p className="mt-6 text-center text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
          No matching listings came back — try widening your budget, radius, or year range.
        </p>
      )}
    </motion.div>
  );
}

function RefineChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="md-chip">
      {label}
    </button>
  );
}

function ProfileSummary({ profile: p }: { profile: WizardProfile }) {
  const bits = [
    `$${p.budget_max.toLocaleString()}`,
    p.radius_miles >= 99999 ? `ZIP ${p.zip_code} · nationwide` : `ZIP ${p.zip_code} · ${p.radius_miles}mi`,
    p.seats ? `${p.seats}+ seats` : null,
    `${p.year_min}–${p.year_max}`,
    `<${(p.max_mileage / 1000).toFixed(0)}k mi`,
    p.drivetrain !== "any" ? p.drivetrain.toUpperCase() : null,
    p.transmission !== "any" ? p.transmission : null,
    p.fuel !== "any" ? p.fuel : null,
    p.cylinders ? `${p.cylinders}-cyl` : null,
    p.keywords.trim() ? `"${p.keywords.trim()}"` : null,
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
    <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: "var(--md-primary)" }} />
      {label}
    </div>
  );
}
