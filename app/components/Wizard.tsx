"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  fuel: "any",
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

export function Wizard({ onComplete }: { onComplete: (profile: WizardProfile) => void }) {
  const [profile, setProfile] = useState<WizardProfile>(DEFAULT_PROFILE);
  const [fuelRating, setFuelRating] = useState(3);
  const [[step, dir], setStep] = useState<[number, number]>([0, 0]);

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

  const variants = {
    enter: (d: number) => ({ x: d >= 0 ? 70 : -70, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d >= 0 ? -70 : 70, opacity: 0 }),
  };

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col px-5 py-8">
      {/* progress */}
      <div className="mb-8">
        <div
          className="mb-2 flex justify-between text-xs font-semibold"
          style={{ color: "var(--md-on-surface-variant)" }}
        >
          <span>
            Step {step + 1} of {total}
          </span>
          <span>{Math.round(((step + 1) / total) * 100)}%</span>
        </div>
        <div className="md-progress-track">
          <motion.div
            className="md-progress-bar"
            animate={{ width: `${((step + 1) / total) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          />
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
            <h2 className="md-headline">{current.title}</h2>
            {current.subtitle && (
              <p className="mt-1.5 text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
                {current.subtitle}
              </p>
            )}
            <div className="mt-7">{current.body}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* nav */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          onClick={() => go(-1)}
          disabled={step === 0}
          className="md-btn md-btn-text disabled:invisible"
        >
          ← Back
        </button>
        <button onClick={() => go(1)} disabled={!current.canNext} className="md-btn md-btn-filled">
          {step === total - 1 ? "Find my cars 🚀" : "Next →"}
        </button>
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
            />
            <span className="text-4xl font-black" style={{ color: "var(--md-primary)" }}>
              –
            </span>
            <EditableNumber
              value={p.year_max}
              onCommit={(v) => update({ year_max: v })}
              min={p.year_min}
              max={CURRENT_YEAR}
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
      subtitle: "RWD is the fun one; AWD grips in bad weather.",
      canNext: true,
      body: (
        <ChoiceGrid
          value={p.drivetrain}
          onChange={(v) => update({ drivetrain: v as WizardProfile["drivetrain"] })}
          options={[
            { value: "any", emoji: "🤷", label: "No preference", desc: "Anything" },
            { value: "awd", emoji: "❄️", label: "AWD / 4WD", desc: "Snow & grip" },
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
          <label
            className="md-choice flex cursor-pointer items-center gap-3"
            data-selected={p.excluded_body_styles.includes("Minivan")}
          >
            <input
              type="checkbox"
              checked={p.excluded_body_styles.includes("Minivan")}
              onChange={(e) =>
                update({ excluded_body_styles: e.target.checked ? ["Minivan"] : [] })
              }
              className="h-5 w-5"
              style={{ accentColor: "var(--md-primary)" }}
            />
            <span className="text-sm font-semibold">🚫 No minivans, ever</span>
          </label>
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
            <SingleChips
              value={p.fuel}
              onChange={(v) => update({ fuel: v as WizardProfile["fuel"] })}
              options={[
                { value: "any", label: "Any" },
                { value: "gas", label: "Gas" },
                { value: "hybrid", label: "Hybrid" },
                { value: "electric", label: "Electric" },
                { value: "diesel", label: "Diesel" },
              ]}
            />
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
                { value: "8", label: "V8" },
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
  className = "text-4xl font-black",
}: {
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  special?: (v: number) => string | null;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const specialLabel = draft === null && special ? special(value) : null;
  const shown = draft !== null ? draft : (specialLabel ?? value.toLocaleString());
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ color: "var(--md-primary)" }}
    >
      {prefix && !specialLabel ? <span>{prefix}</span> : null}
      <input
        value={shown}
        inputMode="numeric"
        aria-label="Edit value"
        onFocus={() => setDraft(specialLabel ? "" : String(value))}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => {
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
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.96 }}
            className="md-choice"
            data-selected={active}
          >
            <div className="text-3xl">{o.emoji}</div>
            <div className="mt-2 font-bold">{o.label}</div>
            <div className="text-xs opacity-70">{o.desc}</div>
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
