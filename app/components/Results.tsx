"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { NormalizedListing, WizardProfile } from "@/lib/types";
import { IconSparkles, IconPencil, IconX, IconLink, IconCheck } from "@tabler/icons-react";
import { runWizardSearch } from "@/lib/search-client";
import { useRecentlyViewed } from "@/lib/client-store";
import { shareUrlForProfile } from "@/lib/share";
import { ResultsList } from "./ResultsList";
import { DetailModal } from "./DetailModal";
import { SaveSearchButton } from "./SaveSearchButton";

export function Results({
  profile: initialProfile,
  onRestart,
  onEditStep,
}: {
  profile: WizardProfile;
  onRestart: () => void;
  onEditStep: (stepIndex: number) => void;
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
  // Reliability nudge: most matches carry a curated known-issue flag (phase-A, instant) and the
  // user hasn't already asked to prioritize reliability.
  const flaggedCount = listings.filter((l) => l.reliability_flag).length;
  const reliabilityDominated =
    done && listings.length >= 4 && flaggedCount / listings.length >= 0.4 && !profile.prioritize_reliability;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="mx-auto w-full max-w-2xl px-5 py-8"
    >
      <div className="mb-5 flex items-center justify-between">
        <h1 className="md-headline">Here&apos;s what I found 🔑</h1>
        <div className="flex items-center gap-2">
          <CopyLinkButton profile={profile} />
          <button onClick={onRestart} className="md-btn md-btn-tonal">
            Start over
          </button>
        </div>
      </div>

      <ProfileSummary profile={profile} onEdit={onEditStep} onClear={refine} />

      {/* advice */}
      {reply ? (
        <div
          className="mt-4 overflow-hidden rounded-2xl border p-5"
          style={{
            background: "var(--md-surface-container)",
            borderColor: "color-mix(in srgb, var(--md-cta) 30%, transparent)",
            boxShadow: "0 0 15px color-mix(in srgb, var(--md-cta) 15%, transparent)",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
            >
              <IconSparkles size={20} />
            </div>
            <div>
              <h3
                className="mb-1 text-sm font-bold uppercase tracking-wider"
                style={{ color: "var(--md-primary)" }}
              >
                Friendly Master Mechanic
              </h3>
              <p className="leading-relaxed" style={{ color: "var(--md-on-surface)" }}>
                {shown}
                {typing && <span className="ml-0.5 inline-block animate-pulse">▌</span>}
              </p>
            </div>
          </div>
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

      {searching && (
        <div className="mt-4">
          <Loader label="Searching live inventory…" />
          <div className="mt-3 space-y-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

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
          {!profile.prioritize_reliability && (
            <RefineChip label="🛡️ More reliable" onClick={() => refine({ prioritize_reliability: true })} />
          )}
          <SaveSearchButton profile={profile} />
        </div>
      )}

      {/* Reliability nudge: when most matches carry a known-issue flag, offer to re-search for
          genuinely more reliable inventory (rather than just hiding cars). */}
      {reliabilityDominated && (
        <div
          className="mt-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "color-mix(in srgb, var(--md-tertiary) 35%, transparent)", background: "color-mix(in srgb, var(--md-tertiary) 10%, transparent)" }}
        >
          <span className="text-sm" style={{ color: "var(--md-on-surface)" }}>
            ⚠️ Most of these have documented reliability problems. Want me to find more reliable options
            in your budget instead?
          </span>
          <button
            onClick={() => refine({ prioritize_reliability: true })}
            className="shrink-0 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wide shadow-md"
            style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
          >
            🛡️ Show more reliable picks
          </button>
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
        <div className="mt-6 rounded-2xl border p-5 text-center" style={{ borderColor: "var(--md-outline-variant)", background: "var(--md-surface-container)" }}>
          <p className="text-sm font-bold">No matches came back for those filters.</p>
          <p className="mt-1 text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
            Loosen one and we&apos;ll search again instantly:
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {profile.radius_miles < 99999 && (
              <RefineChip label="🌍 Search nationwide" onClick={() => refine({ radius_miles: 99999 })} />
            )}
            <RefineChip
              label={`💵 Raise budget to $${Math.round((profile.budget_max * 1.5) / 1000)}k`}
              onClick={() => refine({ budget_max: Math.round(profile.budget_max * 1.5) })}
            />
            {profile.max_mileage < 200000 && (
              <RefineChip label="🛣️ Allow more miles" onClick={() => refine({ max_mileage: 200000 })} />
            )}
            {profile.cylinders > 0 && (
              <RefineChip label="⚙️ Any cylinder count" onClick={() => refine({ cylinders: 0 })} />
            )}
            {(profile.fuels ?? []).length > 0 && (
              <RefineChip label="⛽ Any fuel type" onClick={() => refine({ fuels: [] })} />
            )}
            {profile.drivetrain !== "any" && (
              <RefineChip label="🚙 Any drivetrain" onClick={() => refine({ drivetrain: "any" })} />
            )}
            {(profile.excluded_body_styles ?? []).length > 0 && (
              <RefineChip label="🚫 Clear exclusions" onClick={() => refine({ excluded_body_styles: [] })} />
            )}
            <RefineChip label="✏️ Edit search" onClick={() => onEditStep(0)} />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function RefineChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all"
      style={{
        borderRadius: "var(--md-corner-md)",
        background: "var(--md-surface-container)",
        color: "var(--md-on-surface)",
        border: "1px solid var(--md-outline-variant)",
      }}
    >
      {label}
    </button>
  );
}

// Wizard step indices (must match the order in Wizard.tsx buildSteps) so each chip deep-links
// back to the step that set it.
const STEP = {
  budget: 0,
  location: 1,
  seats: 2,
  years: 3,
  mileage: 4,
  drivetrain: 7,
  transmission: 8,
  bodyStyles: 9,
  specifics: 10, // fuel + cylinders + keywords
} as const;

function ProfileSummary({
  profile: p,
  onEdit,
  onClear,
}: {
  profile: WizardProfile;
  onEdit: (stepIndex: number) => void;
  onClear: (patch: Partial<WizardProfile>) => void;
}) {
  // `clear` (when present) makes the chip removable with an × — only for optional filters; the
  // required ones (budget, location, years, mileage) are edit-only.
  const bits: { label: string; step: number; clear?: Partial<WizardProfile> }[] = [
    { label: `$${p.budget_max.toLocaleString()}`, step: STEP.budget },
    {
      label:
        p.radius_miles >= 99999
          ? `ZIP ${p.zip_code} · nationwide`
          : `ZIP ${p.zip_code} · ${p.radius_miles}mi`,
      step: STEP.location,
    },
    ...(p.seats ? [{ label: `${p.seats}+ seats`, step: STEP.seats, clear: { seats: 0 } }] : []),
    { label: `${p.year_min}–${p.year_max}`, step: STEP.years },
    { label: `<${(p.max_mileage / 1000).toFixed(0)}k mi`, step: STEP.mileage },
    ...(p.drivetrain !== "any"
      ? [{ label: p.drivetrain.toUpperCase(), step: STEP.drivetrain, clear: { drivetrain: "any" as const } }]
      : []),
    ...(p.transmission !== "any"
      ? [{ label: p.transmission, step: STEP.transmission, clear: { transmission: "any" as const } }]
      : []),
    ...(p.fuels ?? []).map((f) => ({
      label: f,
      step: STEP.specifics,
      clear: { fuels: p.fuels.filter((x) => x !== f) },
    })),
    ...(p.cylinders ? [{ label: `${p.cylinders}-cyl`, step: STEP.specifics, clear: { cylinders: 0 } }] : []),
    ...(p.keywords.trim()
      ? [{ label: `"${p.keywords.trim()}"`, step: STEP.specifics, clear: { keywords: "" } }]
      : []),
    ...p.body_styles.map((b) => ({
      label: b,
      step: STEP.bodyStyles,
      clear: { body_styles: p.body_styles.filter((x) => x !== b) },
    })),
    ...(p.excluded_body_styles ?? []).map((b) => ({
      label: `no ${b}`,
      step: STEP.bodyStyles,
      clear: { excluded_body_styles: p.excluded_body_styles.filter((x) => x !== b) },
    })),
  ];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {bits.map((b, i) => (
          <span
            key={`${b.label}-${i}`}
            className="group flex items-center gap-1.5 rounded-full py-1.5 pl-4 pr-2 text-xs font-bold uppercase tracking-wide"
            style={{
              background: "var(--md-surface-container)",
              border: "1px solid var(--md-outline-variant)",
              color: "var(--md-on-surface-variant)",
            }}
          >
            <button
              type="button"
              onClick={() => onEdit(b.step)}
              title="Tap to edit"
              className="flex items-center gap-1.5"
            >
              {b.label}
              <IconPencil
                size={12}
                aria-hidden
                className="opacity-40 transition-opacity group-hover:opacity-90"
                style={{ color: "var(--md-primary)" }}
              />
            </button>
            {b.clear && (
              <button
                type="button"
                onClick={() => onClear(b.clear!)}
                aria-label={`Remove ${b.label}`}
                title="Remove this filter"
                className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-[var(--md-surface-container-highest)]"
                style={{ color: "var(--md-on-surface-variant)" }}
              >
                <IconX size={12} aria-hidden />
              </button>
            )}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
        Tap a chip to edit it, or ✕ to drop that filter.
      </p>
    </div>
  );
}

/** Copy a shareable link to this exact search to the clipboard. */
function CopyLinkButton({ profile }: { profile: WizardProfile }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrlForProfile(profile));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button onClick={copy} className="md-btn md-btn-tonal flex items-center gap-1.5" title="Copy a link to this search">
      {copied ? <IconCheck size={15} aria-hidden /> : <IconLink size={15} aria-hidden />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

/** Placeholder card shown while live inventory streams in. */
function SkeletonCard() {
  return (
    <div
      className="flex animate-pulse overflow-hidden rounded-2xl"
      style={{ background: "var(--md-surface-container)", border: "1px solid var(--md-outline-variant)" }}
    >
      <div className="h-28 w-40 shrink-0" style={{ background: "var(--md-surface-container-high)" }} />
      <div className="flex-1 space-y-2 p-4">
        <div className="h-4 w-2/3 rounded" style={{ background: "var(--md-surface-container-high)" }} />
        <div className="h-3 w-1/3 rounded" style={{ background: "var(--md-surface-container-high)" }} />
        <div className="mt-3 flex gap-2">
          <div className="h-5 w-16 rounded-full" style={{ background: "var(--md-surface-container-high)" }} />
          <div className="h-5 w-16 rounded-full" style={{ background: "var(--md-surface-container-high)" }} />
        </div>
      </div>
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
