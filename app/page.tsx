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
    <div className="relative min-h-dvh overflow-hidden" style={{ background: "var(--md-surface)" }}>
      {/* expressive surface blobs (landing brings its own centered glow) */}
      {stage !== "landing" && (
        <>
          <div
            className="pointer-events-none absolute -left-24 top-6 -z-10 h-80 w-80 rounded-full blur-3xl opacity-50"
            style={{ background: "var(--md-primary-container)" }}
          />
          <div
            className="pointer-events-none absolute -right-24 top-52 -z-10 h-80 w-80 rounded-full blur-3xl opacity-40"
            style={{ background: "var(--md-tertiary-container)" }}
          />
        </>
      )}

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
