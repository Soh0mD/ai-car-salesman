"use client";

import { motion } from "framer-motion";
import { Logo } from "./Logo";

// Ported 1:1 from the Stitch "dascar Landing Page — Teal & Timber Edition" mockup,
// re-expressed with the app's --md-* tokens so it renders in both light and dark.

const PERKS = [
  {
    emoji: "🔭",
    tone: "var(--md-primary)",
    title: "One search, every lot",
    body: "We pull listings from major dealers and local private sellers into one clean, unified feed. Stop hopping between five different sites.",
  },
  {
    emoji: "🛠️",
    tone: "var(--md-tertiary)",
    title: "Reliability built in",
    body: "See live recall data, historical complaint patterns, and known mechanical trap flags right on the listing card. No surprises.",
  },
  {
    emoji: "💬",
    tone: "var(--md-primary)",
    title: "It tells you why",
    body: "We don't just show you cars; we give you real, master-mechanic level buying advice that actively steers you away from money pits.",
  },
];

const NAV_LINKS = ["How it Works", "Reliability", "Pricing"];

export function Landing({ onStart, onAdvanced }: { onStart: () => void; onAdvanced: () => void }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      {/* top nav */}
      <nav
        className="fixed top-0 z-50 w-full backdrop-blur-md"
        style={{ background: "color-mix(in srgb, var(--md-surface) 80%, transparent)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button onClick={onStart} className="active:scale-95 transition-transform">
            <Logo size={36} />
          </button>
          <div className="hidden items-center gap-8 text-sm md:flex">
            <button onClick={onStart} className="font-semibold" style={{ color: "var(--md-primary)" }}>
              Find Cars
            </button>
            {NAV_LINKS.map((l) => (
              <span
                key={l}
                className="cursor-default font-medium"
                style={{ color: "var(--md-on-surface-variant)" }}
              >
                {l}
              </span>
            ))}
          </div>
          <button onClick={onStart} className="md-btn md-btn-filled !px-6 !py-2 !text-sm">
            Get Started
          </button>
        </div>
      </nav>

      <main className="relative flex flex-grow flex-col px-6 pb-16 pt-24">
        {/* animated background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden"
        >
          <motion.div
            className="absolute h-[600px] w-[600px] rounded-full blur-[120px] opacity-40"
            style={{ background: "color-mix(in srgb, var(--md-primary) 16%, transparent)" }}
            animate={{ x: ["-20%", "-12%"], y: ["-10%", "-18%"], scale: [1, 1.1] }}
            transition={{ duration: 10, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          />
          <motion.div
            className="absolute h-[500px] w-[500px] rounded-full blur-[120px] opacity-30"
            style={{ background: "color-mix(in srgb, var(--md-tertiary) 16%, transparent)" }}
            animate={{ x: ["20%", "12%"], y: ["10%", "18%"], scale: [1, 1.1] }}
            transition={{ duration: 12, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          />
        </div>

        {/* hero */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="z-10 mx-auto mb-24 mt-12 flex w-full max-w-4xl flex-col items-center text-center md:mt-24"
        >
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 backdrop-blur-md"
            style={{
              borderColor: "color-mix(in srgb, var(--md-outline) 30%, transparent)",
              background: "color-mix(in srgb, var(--md-surface-container) 60%, transparent)",
            }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--md-primary)" }} />
            <span
              className="text-xs font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--md-on-surface-variant)" }}
            >
              Beta access now open
            </span>
          </div>

          <h1 className="md-display mb-6 leading-[1.1]">
            Find your next car
            <br />
            <span style={{ color: "var(--md-primary)" }}>without the tab chaos.</span>
          </h1>

          <p
            className="mb-10 max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{ color: "var(--md-on-surface-variant)" }}
          >
            Meet your master mechanic friend. We search the real listings, rank them by value, and flag
            the lemons before you waste a weekend at the lot. Fun, honest, and actually helpful.
          </p>

          <div className="flex flex-col items-center gap-4">
            <motion.button
              onClick={onStart}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 rounded-full px-12 py-4 text-xl font-extrabold shadow-xl"
              style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
            >
              GO <span aria-hidden>→</span>
            </motion.button>
            <button
              onClick={onAdvanced}
              className="text-sm font-medium underline underline-offset-4"
              style={{ color: "var(--md-on-surface-variant)" }}
            >
              or just describe it in your own words
            </button>
          </div>
        </motion.section>

        {/* feature cards */}
        <section className="z-10 mx-auto mb-12 w-full max-w-6xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PERKS.map((p) => (
              <motion.div
                key={p.title}
                whileHover={{ y: -4 }}
                className="flex flex-col items-start p-8"
                style={{
                  background: "var(--md-surface-container)",
                  borderRadius: "var(--md-corner-lg)",
                  border: "1px solid color-mix(in srgb, var(--md-outline) 14%, transparent)",
                  boxShadow: "var(--md-elev-1)",
                }}
              >
                <div
                  className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: `color-mix(in srgb, ${p.tone} 14%, transparent)` }}
                >
                  <span className="text-3xl">{p.emoji}</span>
                </div>
                <h3 className="md-title mb-3 text-2xl font-bold">{p.title}</h3>
                <p className="leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
                  {p.body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* footer */}
      <footer
        className="w-full border-t py-10"
        style={{
          background: "var(--md-surface-container)",
          borderColor: "color-mix(in srgb, var(--md-outline) 12%, transparent)",
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold" style={{ color: "var(--md-primary)" }}>
              dascar
            </span>
            <span className="text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
              © 2026 dascar. Your master mechanic friend.
            </span>
          </div>
          <div
            className="flex items-center gap-6 text-sm"
            style={{ color: "var(--md-on-surface-variant)" }}
          >
            {["Terms", "Privacy", "Support", "Contact"].map((l) => (
              <span key={l} className="cursor-default underline-offset-4 hover:underline">
                {l}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
