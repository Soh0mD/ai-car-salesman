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
  body_styles: [],
  excluded_body_styles: [],
};

const BODY_STYLES = ["SUV", "Sedan", "Truck", "Hatchback", "Wagon", "Coupe", "Convertible", "Van"];

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
        <div className="mb-2 flex justify-between text-xs font-semibold text-neutral-500">
          <span>
            Step {step + 1} of {total}
          </span>
          <span>{Math.round(((step + 1) / total) * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
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
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{current.title}</h2>
            {current.subtitle && (
              <p className="mt-1.5 text-sm text-neutral-500">{current.subtitle}</p>
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
          className="rounded-full px-5 py-3 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900 disabled:invisible dark:hover:text-neutral-100"
        >
          ← Back
        </button>
        <button
          onClick={() => go(1)}
          disabled={!current.canNext}
          className="rounded-full bg-emerald-500 px-8 py-3.5 text-base font-extrabold text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:shadow-none dark:disabled:bg-neutral-700"
        >
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
      subtitle: "The top of your range — we'll find value under it.",
      canNext: true,
      body: (
        <div>
          <BigValue>${p.budget_max.toLocaleString()}</BigValue>
          <Slider
            min={3000}
            max={60000}
            step={500}
            value={p.budget_max}
            onChange={(v) => update({ budget_max: v })}
          />
          <Ends left="$3k" right="$60k" />
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
              placeholder="46202"
              className="mt-2 w-40 rounded-2xl border-2 border-neutral-200 bg-white px-4 py-3 text-2xl font-bold tracking-widest outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            {!zipValid && p.zip_code.length > 0 && (
              <p className="mt-1 text-xs text-amber-600">Enter a 5-digit ZIP.</p>
            )}
          </div>
          <div>
            <Label>Search radius — {p.radius_miles} miles</Label>
            <Slider
              min={10}
              max={250}
              step={10}
              value={p.radius_miles}
              onChange={(v) => update({ radius_miles: v })}
            />
            <Ends left="10 mi" right="250 mi" />
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
          <BigValue>
            {p.year_min} – {p.year_max}
          </BigValue>
          <Label>Oldest — {p.year_min}</Label>
          <Slider
            min={2005}
            max={CURRENT_YEAR}
            step={1}
            value={p.year_min}
            onChange={(v) => update({ year_min: Math.min(v, p.year_max) })}
          />
          <Label>Newest — {p.year_max}</Label>
          <Slider
            min={2005}
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
          <BigValue>under {p.max_mileage.toLocaleString()} mi</BigValue>
          <Slider
            min={20000}
            max={200000}
            step={5000}
            value={p.max_mileage}
            onChange={(v) => update({ max_mileage: v })}
          />
          <Ends left="20k" right="200k" />
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
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <input
              type="checkbox"
              checked={p.excluded_body_styles.includes("Minivan")}
              onChange={(e) =>
                update({ excluded_body_styles: e.target.checked ? ["Minivan"] : [] })
              }
              className="h-5 w-5 accent-emerald-500"
            />
            <span className="text-sm font-semibold">🚫 No minivans, ever</span>
          </label>
        </div>
      ),
    },
  ];
}

// ---- input primitives ----

function BigValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 text-center text-4xl font-black text-emerald-600 dark:text-emerald-400">
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-sm font-semibold text-neutral-600 dark:text-neutral-300">
      {children}
    </span>
  );
}

function Ends({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-1.5 flex justify-between text-xs text-neutral-400">
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
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-2 w-full cursor-pointer accent-emerald-500"
    />
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
            className={`rounded-2xl border-2 p-4 text-left transition ${
              active
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700"
            }`}
          >
            <div className="text-3xl">{o.emoji}</div>
            <div className="mt-2 font-bold">{o.label}</div>
            <div className="text-xs text-neutral-500">{o.desc}</div>
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
            className={`h-11 flex-1 rounded-xl text-sm font-bold transition ${
              n <= value
                ? "bg-emerald-500 text-white"
                : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 dark:bg-neutral-800"
            }`}
          >
            {n}
          </motion.button>
        ))}
      </div>
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
            className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
              active
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700"
            }`}
          >
            {o}
          </motion.button>
        );
      })}
    </div>
  );
}
