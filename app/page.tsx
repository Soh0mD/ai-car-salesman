"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WizardProfile } from "@/lib/types";
import { Landing } from "./components/Landing";
import { Wizard } from "./components/Wizard";
import { Results } from "./components/Results";
import { Chat } from "./components/Chat";

type Stage = "landing" | "wizard" | "results" | "chat";

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [profile, setProfile] = useState<WizardProfile | null>(null);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* playful gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-lime-50 via-white to-emerald-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-emerald-950/30" />
      <div className="pointer-events-none absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-600/10" />
      <div className="pointer-events-none absolute -right-24 top-48 -z-10 h-72 w-72 rounded-full bg-lime-300/30 blur-3xl dark:bg-lime-600/10" />

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {stage === "landing" && (
            <Landing onStart={() => setStage("wizard")} onAdvanced={() => setStage("chat")} />
          )}
          {stage === "wizard" && (
            <Wizard
              onComplete={(p) => {
                setProfile(p);
                setStage("results");
              }}
            />
          )}
          {stage === "results" && profile && (
            <Results profile={profile} onRestart={() => setStage("wizard")} />
          )}
          {stage === "chat" && <Chat onHome={() => setStage("landing")} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
