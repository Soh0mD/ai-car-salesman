"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  IconArrowRight,
  IconCar,
  IconCoin,
  IconCompass,
  IconMessageChatbot,
  IconRadar2,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";
import type { WizardProfile } from "@/lib/types";
import { Dropdown } from "./Dropdown";

// "Joyride" landing — real dascar flows, --md-* tokens (light + dark), Tabler line icons,
// self-contained SVG hero.

const PERKS = [
  {
    icon: IconRadar2,
    tone: "var(--md-primary)",
    title: "One search, every lot",
    body: "Dealers and private sellers pulled into one clean feed — no juggling ten tabs across Autotrader, eBay, and the rest.",
  },
  {
    icon: IconShieldCheck,
    tone: "var(--md-tertiary)",
    title: "Reliability built in",
    body: "Live NHTSA recalls, complaint patterns, and known-trap flags on every car. The other guys show you none of this.",
  },
  {
    icon: IconMessageChatbot,
    tone: "var(--md-primary)",
    title: "It tells you why",
    body: "Real, master-mechanic buying advice that steers you away from money-pit engines and toward cars that actually last.",
  },
];

const BODY_OPTIONS = [
  { value: "", label: "Any body style" },
  ...["SUV", "Sedan", "Truck", "Hatchback", "Wagon", "Coupe", "Convertible", "Van"].map((b) => ({ value: b, label: b })),
];
const BUDGET_OPTIONS = [
  { value: "", label: "Any budget" },
  { value: "15000", label: "Under $15k" },
  { value: "25000", label: "$15k – $25k" },
  { value: "35000", label: "$25k – $35k" },
  { value: "60000", label: "$35k+" },
];

export function Landing({
  onStart,
  onAdvanced,
}: {
  onStart: (prefill?: Partial<WizardProfile>) => void;
  onAdvanced: () => void;
}) {
  const [bodyStyle, setBodyStyle] = useState("");
  const [budget, setBudget] = useState("");

  const quickStart = () => {
    const pre: Partial<WizardProfile> = {};
    if (bodyStyle) pre.body_styles = [bodyStyle];
    if (budget) pre.budget_max = Number(budget);
    onStart(Object.keys(pre).length ? pre : undefined);
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      {/* nav */}
      <nav
        className="sticky top-0 z-50 w-full backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--md-surface) 70%, transparent)",
          borderBottom: "1px solid var(--md-outline-variant)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={() => onStart()} className="flex items-center gap-2.5 transition-transform active:scale-95">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[9px]"
              style={{ background: "linear-gradient(135deg, var(--md-cta), var(--md-tertiary))", color: "#fff" }}
            >
              <IconCar size={18} aria-hidden />
            </span>
            <span className="md-title text-xl font-extrabold tracking-tight">
              das<span style={{ color: "var(--md-primary)" }}>car</span>
            </span>
          </button>
          <button onClick={() => onStart()} className="md-btn md-btn-filled !px-5 !py-2 !text-sm">
            Get started <IconArrowRight size={15} aria-hidden />
          </button>
        </div>
      </nav>

      <main className="relative flex-grow">
        {/* hero */}
        <section className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 pt-14 lg:grid-cols-[1.05fr_.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold"
              style={{ background: "color-mix(in srgb, var(--md-tertiary) 18%, transparent)", color: "var(--md-tertiary)" }}
            >
              <IconSparkles size={14} aria-hidden /> Your sidekick for the hunt
            </span>
            <h1 className="md-display mt-4 leading-[1.08]">
              Find your next car
              <br />
              without the <span style={{ color: "var(--md-primary)" }}>tab chaos.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
              Answer a few quick questions and dascar searches every lot at once, ranks the finds by real
              value, and flags the lemons before you fall for one. Like a master-mechanic friend in your pocket.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <motion.button
                onClick={() => onStart()}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-bold shadow-lg"
                style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
              >
                Start the quiz <IconCompass size={18} aria-hidden />
              </motion.button>
              <motion.button
                onClick={onAdvanced}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="rounded-full px-6 py-3.5 text-base font-bold"
                style={{ background: "transparent", color: "var(--md-primary)", border: "2px solid color-mix(in srgb, var(--md-primary) 45%, transparent)" }}
              >
                Describe it yourself
              </motion.button>
            </div>
          </motion.div>

          {/* hero illustration (decorative) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 24, delay: 0.05 }}
            className="relative"
          >
            <svg viewBox="0 0 320 240" aria-hidden className="block h-auto w-full rounded-2xl" style={{ background: "#0f3b44" }}>
              <circle cx="248" cy="60" r="34" fill="#e6b88f" opacity="0.55" />
              <circle cx="248" cy="60" r="22" fill="#f0c79f" />
              <path d="M0,150 Q80,110 170,140 T320,128 V240 H0 Z" fill="#1c6a6f" />
              <path d="M0,178 Q90,150 200,176 T320,166 V240 H0 Z" fill="#218490" />
              <path d="M0,210 Q120,186 220,210 T320,206 V240 H0 Z" fill="#2a99a0" />
              <path d="M40,236 Q150,150 300,176" fill="none" stroke="#0c2e34" strokeWidth="22" strokeLinecap="round" />
              <path d="M40,236 Q150,150 300,176" fill="none" stroke="#cfe3e8" strokeWidth="2.5" strokeDasharray="9 11" strokeLinecap="round" opacity="0.7" />
              <g transform="translate(120,150) rotate(-13)">
                <ellipse cx="34" cy="44" rx="40" ry="7" fill="#08252b" opacity="0.4" />
                <rect x="2" y="22" width="64" height="20" rx="9" fill="#c98a5a" />
                <path d="M12,24 Q18,7 34,7 L48,7 Q58,7 62,24 Z" fill="#e0a877" />
                <path d="M20,23 Q24,12 34,12 L45,12 Q52,12 55,23 Z" fill="#9fe0e8" />
                <circle cx="20" cy="42" r="9" fill="#0c2e34" />
                <circle cx="20" cy="42" r="4" fill="#cfe3e8" />
                <circle cx="50" cy="42" r="9" fill="#0c2e34" />
                <circle cx="50" cy="42" r="4" fill="#cfe3e8" />
              </g>
            </svg>
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute right-3 top-3 flex items-center gap-2.5 rounded-xl px-3 py-2"
              style={{
                background: "var(--md-surface-container)",
                border: "1px solid color-mix(in srgb, var(--md-primary) 25%, transparent)",
                boxShadow: "var(--md-elev-2)",
                willChange: "transform",
              }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>
                <IconShieldCheck size={17} aria-hidden />
              </span>
              <span>
                <span className="block text-[10px] font-semibold" style={{ color: "var(--md-on-surface-variant)" }}>
                  Recalls &amp; complaints
                </span>
                <span className="block text-[13px] font-bold">Checked on every car</span>
              </span>
            </motion.div>
          </motion.div>
        </section>

        {/* quick search — prefills the wizard */}
        <section className="relative z-20 mx-auto mt-6 max-w-5xl px-6">
          <div
            className="flex flex-col gap-3 rounded-2xl p-3.5 shadow-xl md:flex-row md:items-center"
            style={{ background: "var(--md-surface-container-lowest)", border: "1px solid var(--md-outline-variant)" }}
          >
            <Dropdown
              className="flex-1"
              value={bodyStyle}
              onChange={setBodyStyle}
              options={BODY_OPTIONS}
              placeholder="Any body style"
              ariaLabel="Body style"
              icon={<IconCar size={18} style={{ color: "var(--md-tertiary)" }} aria-hidden />}
            />
            <Dropdown
              className="flex-1"
              value={budget}
              onChange={setBudget}
              options={BUDGET_OPTIONS}
              placeholder="Any budget"
              ariaLabel="Budget"
              icon={<IconCoin size={18} style={{ color: "var(--md-tertiary)" }} aria-hidden />}
            />
            <button
              onClick={quickStart}
              className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold"
              style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
            >
              <IconSearch size={17} aria-hidden /> Explore options
            </button>
          </div>
        </section>

        {/* feature trio */}
        <section className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PERKS.map((p) => (
              <motion.div
                key={p.title}
                whileHover={{ y: -4 }}
                className="rounded-2xl p-6"
                style={{ background: "var(--md-surface-container-low)", border: "1px solid var(--md-outline-variant)" }}
              >
                <span
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `color-mix(in srgb, ${p.tone} 16%, transparent)`, color: p.tone }}
                >
                  <p.icon size={23} aria-hidden />
                </span>
                <h3 className="md-title mb-2 text-base font-bold">{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
                  {p.body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* footer */}
      <footer className="w-full px-6 py-6" style={{ borderTop: "1px solid var(--md-outline-variant)" }}>
        <div className="mx-auto flex max-w-6xl justify-center">
          <span className="md-title font-extrabold" style={{ color: "var(--md-primary)" }}>
            dascar
          </span>
        </div>
      </footer>
    </div>
  );
}
