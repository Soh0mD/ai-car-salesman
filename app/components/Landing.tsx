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
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 22 } },
};

export function Landing({
  onStart,
  onAdvanced,
}: {
  onStart: () => void;
  onAdvanced: () => void;
}) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-5 text-center"
    >
      <motion.div
        variants={item}
        className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      >
        🚗 AI Car Salesman
      </motion.div>

      <motion.h1
        variants={item}
        className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl"
      >
        Find your next car
        <br />
        <span className="bg-gradient-to-r from-emerald-500 to-lime-500 bg-clip-text text-transparent">
          without the tab chaos.
        </span>
      </motion.h1>

      <motion.p
        variants={item}
        className="mt-5 max-w-xl text-lg text-neutral-600 dark:text-neutral-300"
      >
        Answer a few quick questions and we&apos;ll search real listings across dealers and
        private sellers — then rank them by value and flag the lemons before you fall for one.
      </motion.p>

      <motion.button
        variants={item}
        onClick={onStart}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="mt-9 rounded-full bg-emerald-500 px-12 py-5 text-xl font-extrabold text-white shadow-lg shadow-emerald-500/30 transition-colors hover:bg-emerald-600"
      >
        GO →
      </motion.button>

      <motion.button
        variants={item}
        onClick={onAdvanced}
        className="mt-4 text-sm font-medium text-neutral-500 underline-offset-4 hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
      >
        or just describe it in your own words →
      </motion.button>

      <motion.div
        variants={item}
        className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3"
      >
        {PERKS.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-neutral-200 bg-white/70 p-5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <div className="text-3xl">{p.emoji}</div>
            <h3 className="mt-2 font-bold">{p.title}</h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{p.body}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
