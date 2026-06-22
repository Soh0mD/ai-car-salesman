"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconBulb } from "@tabler/icons-react";
import type { WizardProfile } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_PROFILE: WizardProfile = {
  budget_max: 20000,
  zip_code: "",
  radius_miles: 50,
  seats: 5,
  year_min: CURRENT_YEAR - 10,
  year_max: CURRENT_YEAR,
  max_mileage: 100000,
  primary_use: "commute",
  fuel_priority: "medium",
  safety: 3,
  fun: 3,
  drivetrain: "any",
  transmission: "any",
  fuels: [],
  cylinders: 0,
  keywords: "",
  body_styles: [],
  excluded_body_styles: [],
};

const BODY_STYLES = ["SUV", "Sedan", "Truck", "Hatchback", "Wagon", "Coupe", "Convertible", "Van"];

// Non-linear stops: fine granularity where most shoppers are, big jumps at the high end.
const BUDGET_STOPS = [
  3000, 5000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000, 150000,
  200000, 300000, 500000, 750000, 1000000,
];
const RADIUS_STOPS = [10, 25, 50, 100, 150, 250, 500, 99999]; // 99999 = Nationwide
const MILEAGE_STOPS = [
  500, 1000, 2500, 5000, 10000, 25000, 50000, 75000, 100000, 125000, 150000, 200000,
];
const OLDEST_YEAR = 1981; // 17-digit VINs standardized in 1981 — the floor the APIs reliably cover

// One genuinely-useful "Pro tip" per step (index matches the steps array order below),
// to guide a buyer like a master-mechanic friend.
const STEP_TIPS = [
  "Set your max a little below your true ceiling — leave ~10% for taxes, fees, and a pre-purchase inspection.",
  "Widening your radius even a little often unlocks better-priced cars — a few hours' drive can save thousands.",
  "Counting car seats? Three across the back is tight in most sedans — a midsize SUV or 3-row is far easier.",
  "The sweet spot is often 3–5 years old: the first owner already ate the steep depreciation, and it's still modern.",
  "How miles were driven matters more than the number — 100k highway miles can beat 60k of stop-and-go. ~12k/year is average.",
  "Be honest about real use: most 'I might tow or off-road' buyers rarely do, and pay for that capability in fuel every day.",
  "You usually can't max everything — picking your top one or two priorities gets you sharper, more honest matches.",
  "AWD helps you go in snow but not stop — good winter tires on FWD often matter more, and AWD costs more to run and repair.",
  "Love a manual? Great for engagement and theft resistance, but they're rare — expect a smaller pool and some patience.",
  "Hatchbacks and wagons swallow more cargo than a sedan and park easier than an SUV — an underrated sweet spot.",
  "Naming a specific trim or engine (e.g. 'Z51', 'TDI', 'Nismo') narrows results fast — leave it blank if you're still exploring.",
];

export function Wizard({
  onComplete,
  initial,
  initialStep = 0,
  editing = false,
  onHome,
}: {
  onComplete: (profile: WizardProfile) => void;
  initial?: Partial<WizardProfile>;
  initialStep?: number;
  editing?: boolean; // entered by editing a results chip — offer a direct "Apply changes" exit
  onHome: () => void;
}) {
  const [profile, setProfile] = useState<WizardProfile>({ ...DEFAULT_PROFILE, ...initial });
  // Seed the fuel-priority rating from the incoming profile so the stars reflect saved answers.
  const [fuelRating, setFuelRating] = useState(
    initial?.fuel_priority === "low" ? 2 : initial?.fuel_priority === "high" ? 5 : 3,
  );
  const [[step, dir], setStep] = useState<[number, number]>([initialStep, 0]);

  const update = (patch: Partial<WizardProfile>) => setProfile((p) => ({ ...p, ...patch }));

  const steps = buildSteps(profile, update, fuelRating, (r) => {
    setFuelRating(r);
    update({ fuel_priority: r <= 2 ? "low" : r === 3 ? "medium" : "high" });
  });
  const total = steps.length;
  const current = steps[step];

  const go = (delta: number) => {
    const next = step + delta;
    if (next < 0) return;
    if (next >= total) {
      onComplete(profile);
      return;
    }
    setStep([next, delta]);
  };

  // Keyboard: Enter advances to the next step (or finishes) — but not while typing in a field,
  // where Enter commits the value instead. Re-subscribes on any state that `go` depends on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (current.canNext) {
        e.preventDefault();
        go(1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, total, profile, current.canNext]);

  const variants = {
    enter: (d: number) => ({ x: d >= 0 ? 70 : -70, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d >= 0 ? -70 : 70, opacity: 0 }),
  };

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onHome}
          className="flex items-center gap-1.5 text-sm font-bold transition-opacity hover:opacity-80"
          style={{ color: "var(--md-on-surface-variant)" }}
        >
          <span aria-hidden>←</span> Home
        </button>
        {editing && (
          <motion.button
            onClick={() => onComplete(profile)}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] shadow-md"
            style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
          >
            Apply changes <span aria-hidden>🔎</span>
          </motion.button>
        )}
      </div>

      {/* progress — thin track with a sienna leading-edge "needle" (Stitch) */}
      <div className="mb-12">
        <div className="mb-3 flex items-end justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--md-on-surface-variant)" }}
          >
            Step {step + 1} of {total}
          </span>
          <span className="text-[10px] font-bold tracking-[0.1em]" style={{ color: "var(--md-cta)" }}>
            {Math.round(((step + 1) / total) * 100)}%
          </span>
        </div>
        <div
          className="relative h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--md-surface-container-highest)" }}
        >
          <motion.div
            className="relative h-full rounded-full"
            style={{ background: "var(--md-cta)" }}
            animate={{ width: `${((step + 1) / total) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          >
            <span
              className="absolute right-0 top-0 h-full w-[2px]"
              style={{
                background: "var(--md-tertiary)",
                boxShadow: "0 0 8px color-mix(in srgb, var(--md-tertiary) 60%, transparent)",
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* step body */}
      <div className="relative flex-1">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <h2 className="md-headline text-center">{current.title}</h2>
            {current.subtitle && (
              <p className="mt-2 text-center text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
                {current.subtitle}
              </p>
            )}
            <div className="mt-7">{current.body}</div>
            {STEP_TIPS[step] && (
              <div className="mt-7">
                <ProTip>{STEP_TIPS[step]}</ProTip>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* nav — uppercase Back / luminous-teal Next (Stitch) */}
      <div className="mt-10 flex items-center justify-between gap-3">
        <button
          onClick={() => go(-1)}
          disabled={step === 0}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] transition-colors disabled:invisible"
          style={{ color: "var(--md-on-surface-variant)" }}
        >
          <span aria-hidden>←</span> Back
        </button>
        <motion.button
          onClick={() => go(1)}
          disabled={!current.canNext}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 rounded-full px-10 py-4 text-sm font-bold uppercase tracking-[0.15em] shadow-lg disabled:opacity-45"
          style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
        >
          {step === total - 1 ? "Find my cars 🚀" : <>Next <span aria-hidden>→</span></>}
        </motion.button>
      </div>
    </div>
  );
}

// ---- step definitions ----

interface Step {
  title: string;
  subtitle?: string;
  body: React.ReactNode;
  canNext: boolean;
}

function buildSteps(
  p: WizardProfile,
  update: (patch: Partial<WizardProfile>) => void,
  fuelRating: number,
  setFuel: (r: number) => void,
): Step[] {
  const zipValid = /^\d{5}$/.test(p.zip_code);
  return [
    {
      title: "What's your budget?",
      subtitle: "The most you'd spend.",
      canNext: true,
      body: (
        <div>
          <div className="mb-5 flex justify-center">
            <EditableNumber
              value={p.budget_max}
              onCommit={(v) => update({ budget_max: v })}
              min={500}
              max={2_000_000}
              prefix="$"
            />
          </div>
          <StepSlider
            stops={BUDGET_STOPS}
            value={p.budget_max}
            onChange={(v) => update({ budget_max: v })}
          />
          <Ends left="$3k" right="$1M+" />
        </div>
      ),
    },
    {
      title: "Where are you shopping?",
      subtitle: "We search dealers and sellers around you.",
      canNext: zipValid,
      body: (
        <div className="space-y-6">
          <div>
            <Label>ZIP code</Label>
            <input
              inputMode="numeric"
              maxLength={5}
              value={p.zip_code}
              onChange={(e) => update({ zip_code: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              aria-label="ZIP code"
              className="md-field mt-2 w-44 text-center text-2xl font-bold tracking-widest"
            />
            {!zipValid && p.zip_code.length > 0 && (
              <p className="mt-1 text-xs" style={{ color: "var(--md-error)" }}>
                Enter a 5-digit ZIP.
              </p>
            )}
          </div>
          <div>
            <Label>Search radius</Label>
            <div className="mb-3 mt-1 flex justify-center">
              <EditableNumber
                value={p.radius_miles}
                onCommit={(v) => update({ radius_miles: v })}
                min={5}
                max={99999}
                suffix=" mi"
                special={(v) => (v >= 5000 ? "Nationwide" : null)}
                className="text-2xl font-black"
              />
            </div>
            <StepSlider
              stops={RADIUS_STOPS}
              value={p.radius_miles}
              onChange={(v) => update({ radius_miles: v })}
            />
            <Ends left="10 mi" right="Nationwide" />
          </div>
        </div>
      ),
    },
    {
      title: "How many seats?",
      canNext: true,
      body: (
        <ChoiceGrid
          value={p.seats}
          onChange={(v) => update({ seats: v as number })}
          options={[
            { value: 0, emoji: "🤷", label: "Any", desc: "No minimum" },
            { value: 2, emoji: "🧍", label: "Just me", desc: "2 seats" },
            { value: 5, emoji: "🚗", label: "Everyday", desc: "5 seats" },
            { value: 7, emoji: "👨‍👩‍👧‍👦", label: "Family", desc: "6–7 seats" },
            { value: 8, emoji: "🚐", label: "Big crew", desc: "8+ seats" },
          ]}
        />
      ),
    },
    {
      title: "How new a car?",
      subtitle: "Model years you'd consider.",
      canNext: true,
      body: (
        <div>
          <div className="mb-5 flex items-center justify-center gap-3">
            <EditableNumber
              value={p.year_min}
              onCommit={(v) => update({ year_min: v })}
              min={OLDEST_YEAR}
              max={p.year_max}
              plain
            />
            <span className="text-4xl font-black" style={{ color: "var(--md-primary)" }}>
              –
            </span>
            <EditableNumber
              value={p.year_max}
              onCommit={(v) => update({ year_max: v })}
              min={p.year_min}
              max={CURRENT_YEAR}
              plain
            />
          </div>
          <Label>Oldest</Label>
          <Slider
            min={OLDEST_YEAR}
            max={CURRENT_YEAR}
            step={1}
            value={p.year_min}
            onChange={(v) => update({ year_min: Math.min(v, p.year_max) })}
          />
          <Label>Newest</Label>
          <Slider
            min={OLDEST_YEAR}
            max={CURRENT_YEAR}
            step={1}
            value={p.year_max}
            onChange={(v) => update({ year_max: Math.max(v, p.year_min) })}
          />
        </div>
      ),
    },
    {
      title: "Mileage ceiling?",
      subtitle: "The most miles you'd accept.",
      canNext: true,
      body: (
        <div>
          <div className="mb-1 flex justify-center">
            <EditableNumber
              value={p.max_mileage}
              onCommit={(v) => update({ max_mileage: v })}
              min={0}
              max={300000}
              suffix=" mi"
            />
          </div>
          <p
            className="mb-4 text-center text-sm"
            style={{ color: "var(--md-on-surface-variant)" }}
          >
            {p.max_mileage <= 500 ? "basically new" : "maximum miles"}
          </p>
          <StepSlider
            stops={MILEAGE_STOPS}
            value={p.max_mileage}
            onChange={(v) => update({ max_mileage: v })}
          />
          <Ends left="≤500 (new)" right="200k" />
        </div>
      ),
    },
    {
      title: "What's it mainly for?",
      canNext: true,
      body: (
        <ChoiceGrid
          value={p.primary_use}
          onChange={(v) => update({ primary_use: v as WizardProfile["primary_use"] })}
          options={[
            { value: "commute", emoji: "🚦", label: "Commuting", desc: "Daily driving" },
            { value: "family", emoji: "🧸", label: "Family", desc: "Space & safety" },
            { value: "fun", emoji: "🏎️", label: "Fun", desc: "Weekend joy" },
            { value: "first_car", emoji: "🔰", label: "First car", desc: "New driver" },
            { value: "work", emoji: "🛻", label: "Work", desc: "Hauling/utility" },
          ]}
        />
      ),
    },
    {
      title: "What matters most?",
      subtitle: "Rate each from low to high.",
      canNext: true,
      body: (
        <div className="space-y-7">
          <Rating label="⛽ Fuel economy" value={fuelRating} onChange={setFuel} />
          <Rating label="🛡️ Safety" value={p.safety} onChange={(v) => update({ safety: v })} />
          <Rating label="😎 Fun to drive" value={p.fun} onChange={(v) => update({ fun: v })} />
        </div>
      ),
    },
    {
      title: "Drivetrain preference?",
      subtitle: "AWD grips in rain/snow; 4WD is for trucks & off-road.",
      canNext: true,
      body: (
        <ChoiceGrid
          value={p.drivetrain}
          onChange={(v) => update({ drivetrain: v as WizardProfile["drivetrain"] })}
          options={[
            { value: "any", emoji: "🤷", label: "No preference", desc: "Anything" },
            { value: "awd", emoji: "❄️", label: "AWD", desc: "All-wheel grip" },
            { value: "4wd", emoji: "🏔️", label: "4WD", desc: "Trucks & off-road" },
            { value: "fwd", emoji: "🚗", label: "FWD", desc: "Efficient" },
            { value: "rwd", emoji: "🏎️", label: "RWD", desc: "Sporty & fun" },
          ]}
        />
      ),
    },
    {
      title: "Transmission?",
      subtitle: "Three pedals or two?",
      canNext: true,
      body: (
        <ChoiceGrid
          value={p.transmission}
          onChange={(v) => update({ transmission: v as WizardProfile["transmission"] })}
          options={[
            { value: "any", emoji: "🤷", label: "Either", desc: "No preference" },
            { value: "automatic", emoji: "🚙", label: "Automatic", desc: "Easy driving" },
            { value: "manual", emoji: "🕹️", label: "Manual", desc: "Stick shift" },
          ]}
        />
      ),
    },
    {
      title: "Any body styles you love?",
      subtitle: "Optional — pick any, or skip.",
      canNext: true,
      body: (
        <div className="space-y-6">
          <Chips
            options={BODY_STYLES}
            selected={p.body_styles}
            onToggle={(s) =>
              update({
                body_styles: p.body_styles.includes(s)
                  ? p.body_styles.filter((x) => x !== s)
                  : [...p.body_styles, s],
              })
            }
          />
          <div>
            <Label>Exclude any body styles? (optional)</Label>
            <input
              value={p.excluded_body_styles.join(", ")}
              onChange={(e) =>
                update({
                  excluded_body_styles: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="e.g. Minivan, Coupe, Convertible"
              className="md-field mt-1 w-full text-sm"
            />
            <p className="mt-1.5 text-xs" style={{ color: "var(--md-on-surface-variant)" }}>
              Comma-separated. We&apos;ll drop anything matching these from your results.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Anything specific? (optional)",
      subtitle: "All optional — leave blank to skip.",
      canNext: true,
      body: (
        <div className="space-y-6">
          <div>
            <Label>Fuel type</Label>
            <MultiChips
              selected={p.fuels}
              onToggle={(v) =>
                update({
                  fuels: p.fuels.includes(v) ? p.fuels.filter((x) => x !== v) : [...p.fuels, v],
                })
              }
              options={[
                { value: "gas", label: "Gas" },
                { value: "hybrid", label: "Hybrid" },
                { value: "electric", label: "Electric" },
                { value: "diesel", label: "Diesel" },
              ]}
            />
            <p className="mt-1.5 text-xs" style={{ color: "var(--md-on-surface-variant)" }}>
              Pick any combination, or leave blank for any.
            </p>
          </div>
          <div>
            <Label>Cylinders</Label>
            <SingleChips
              value={String(p.cylinders)}
              onChange={(v) => update({ cylinders: Number(v) })}
              options={[
                { value: "0", label: "Any" },
                { value: "4", label: "4-cyl" },
                { value: "6", label: "6-cyl" },
                { value: "8", label: "8-cyl" },
                { value: "10", label: "10-cyl" },
                { value: "12", label: "12-cyl" },
              ]}
            />
          </div>
          <div>
            <Label>Must-have keyword</Label>
            <input
              value={p.keywords}
              onChange={(e) => update({ keywords: e.target.value })}
              placeholder="e.g. supercharged, Z51, Nismo"
              className="md-field mt-1 w-full text-sm"
            />
          </div>
        </div>
      ),
    },
  ];
}

// ---- input primitives ----

function ProTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="md-protip text-sm">
      <span aria-hidden style={{ color: "var(--md-tertiary)" }}>
        <IconBulb size={18} />
      </span>
      <span>
        <span className="md-protip-label mb-0.5 block">Pro tip</span>
        <span style={{ color: "var(--md-on-surface-variant)" }}>{children}</span>
      </span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-2 block text-sm font-semibold"
      style={{ color: "var(--md-on-surface-variant)" }}
    >
      {children}
    </span>
  );
}

function Ends({ left, right }: { left: string; right: string }) {
  return (
    <div
      className="mt-1.5 flex justify-between text-xs"
      style={{ color: "var(--md-on-surface-variant)" }}
    >
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function Slider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="md-slider"
      style={{ ["--pct"]: `${pct}%` } as React.CSSProperties}
    />
  );
}

/** Slider over a fixed set of non-linear stops (e.g. budget $3k…$1M). Value must be a stop. */
function StepSlider({
  stops,
  value,
  onChange,
}: {
  stops: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  // Nearest stop (not exact match) so a typed off-stop value still positions the thumb sensibly.
  const idx = stops.reduce(
    (best, s, i) => (Math.abs(s - value) < Math.abs(stops[best] - value) ? i : best),
    0,
  );
  const pct = stops.length > 1 ? (idx / (stops.length - 1)) * 100 : 0;
  return (
    <input
      type="range"
      min={0}
      max={stops.length - 1}
      step={1}
      value={idx}
      onChange={(e) => onChange(stops[Number(e.target.value)])}
      className="md-slider"
      style={{ ["--pct"]: `${pct}%` } as React.CSSProperties}
    />
  );
}

/**
 * A number you can type OR slide to. The displayed value is itself a borderless input — type
 * digits to edit, Enter/blur to commit (clamped). `special` shows a word (e.g. "Nationwide")
 * in place of the number when applicable; focusing it clears for fresh entry.
 */
function EditableNumber({
  value,
  onCommit,
  min,
  max,
  prefix = "",
  suffix = "",
  special,
  plain = false,
  className = "text-4xl font-black",
}: {
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  special?: (v: number) => string | null;
  plain?: boolean; // no thousands separators (e.g. years)
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const specialLabel = draft === null && special ? special(value) : null;
  const formatted = plain ? String(value) : value.toLocaleString();
  const shown = draft !== null ? draft : (specialLabel ?? formatted);
  return (
    <span className="inline-flex flex-col items-center gap-1" title="Click to type, or drag the slider">
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{
          color: "var(--md-primary)",
          borderBottom: `2px ${focused ? "solid" : "dashed"} ${
            focused ? "var(--md-primary)" : "var(--md-outline)"
          }`,
          paddingBottom: "0.1rem",
          transition: "border-color 0.15s, border-style 0.15s",
        }}
      >
        {prefix && !specialLabel ? <span>{prefix}</span> : null}
        <input
          value={shown}
          inputMode="numeric"
          aria-label="Edit value"
          onFocus={() => {
            setFocused(true);
            setDraft(specialLabel ? "" : String(value));
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => {
            setFocused(false);
            onCommit(Math.min(max, Math.max(min, Number(draft || 0))));
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="bg-transparent text-center outline-none"
          style={{ width: `${Math.max(1, shown.length)}ch` }}
        />
        {suffix && !specialLabel ? <span>{suffix}</span> : null}
      </span>
      <span
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--md-on-surface-variant)", opacity: 0.8 }}
      >
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Tap to type
      </span>
    </span>
  );
}

function ChoiceGrid<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; emoji: string; label: string; desc: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.98 }}
            className="flex flex-col items-center rounded-2xl p-6 text-center transition-all"
            style={
              active
                ? {
                    background: "var(--md-cta)",
                    boxShadow:
                      "inset 0 0 0 2px var(--md-primary), 0 0 20px color-mix(in srgb, var(--md-cta) 30%, transparent)",
                  }
                : { background: "color-mix(in srgb, var(--md-primary-container) 55%, transparent)" }
            }
          >
            <span className="mb-3 text-3xl" style={active ? undefined : { filter: "grayscale(1)" }}>
              {o.emoji}
            </span>
            <span
              className="mb-1 block font-bold"
              style={{ color: active ? "var(--md-on-cta)" : "var(--md-on-surface)" }}
            >
              {o.label}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: active
                  ? "color-mix(in srgb, var(--md-on-cta) 80%, transparent)"
                  : "var(--md-on-surface-variant)",
              }}
            >
              {o.desc}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function Rating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            onClick={() => onChange(n)}
            whileTap={{ scale: 0.9 }}
            className="h-11 flex-1 rounded-xl text-sm font-bold transition"
            style={
              n <= value
                ? { background: "var(--md-primary)", color: "var(--md-on-primary)" }
                : {
                    background: "var(--md-surface-container-high)",
                    color: "var(--md-on-surface-variant)",
                  }
            }
          >
            {n}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function SingleChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => (
        <motion.button
          key={o.value}
          onClick={() => onChange(o.value)}
          whileTap={{ scale: 0.95 }}
          className="md-chip"
          data-selected={o.value === value}
        >
          {o.label}
        </motion.button>
      ))}
    </div>
  );
}

/** Like SingleChips but multi-select (toggles values in/out of an array). */
function MultiChips({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => (
        <motion.button
          key={o.value}
          onClick={() => onToggle(o.value)}
          whileTap={{ scale: 0.95 }}
          className="md-chip"
          data-selected={selected.includes(o.value)}
        >
          {o.label}
        </motion.button>
      ))}
    </div>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <motion.button
            key={o}
            onClick={() => onToggle(o)}
            whileTap={{ scale: 0.95 }}
            className="md-chip"
            data-selected={active}
          >
            {o}
          </motion.button>
        );
      })}
    </div>
  );
}
