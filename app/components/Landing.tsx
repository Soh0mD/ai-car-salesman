"use client";

import { motion } from "framer-motion";

const PERKS = [
  {
    emoji: "🔭",
    title: "One search, every lot",
    body: "Dealers and private sellers in one place — no juggling ten tabs across Autotrader, eBay, and the rest.",
  },
  {
    emoji: "🛠️",
    title: "Reliability built in",
    body: "Live NHTSA recalls + complaint data + known-trap flags on every car. The other guys show you none of this.",
  },
  {
    emoji: "💬",
    title: "It tells you why",
    body: "Real buying advice that steers you away from money-pit engines and toward cars that actually last.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 22 } },
};

export function Landing({ onStart, onAdvanced }: { onStart: () => void; onAdvanced: () => void }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto flex min-h-[82vh] max-w-3xl flex-col items-center justify-center px-5 text-center"
    >
      <motion.div variants={item} className="md-chip mb-5" data-selected="true">
        🚗 AI Car Salesman
      </motion.div>

      <motion.h1 variants={item} className="md-display">
        Find your next car
        <br />
        <span style={{ color: "var(--md-primary)" }}>without the tab chaos.</span>
      </motion.h1>

      <motion.p
        variants={item}
        className="mt-5 max-w-xl text-lg"
        style={{ color: "var(--md-on-surface-variant)" }}
      >
        Answer a few quick questions and we&apos;ll search real listings across dealers and
        private sellers — then rank them by value and flag the lemons before you fall for one.
      </motion.p>

      <motion.button
        variants={item}
        onClick={onStart}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="md-btn md-btn-filled md-btn-lg mt-10"
      >
        GO →
      </motion.button>

      <motion.button variants={item} onClick={onAdvanced} className="md-btn md-btn-text mt-3">
        or just describe it in your own words →
      </motion.button>

      <motion.div variants={item} className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
        {PERKS.map((p) => (
          <div key={p.title} className="md-card md-card-outlined p-5">
            <div className="text-3xl">{p.emoji}</div>
            <h3 className="md-title mt-2">{p.title}</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
              {p.body}
            </p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
