"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WizardProfile } from "@/lib/types";
import { profileFromUrl, saveLastSearch } from "@/lib/share";
import { Landing } from "./components/Landing";
import { Wizard } from "./components/Wizard";
import { Results } from "./components/Results";
import { Chat } from "./components/Chat";

type Stage = "landing" | "wizard" | "results" | "chat";

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [profile, setProfile] = useState<WizardProfile | null>(null);
  // What the wizard initializes from: the landing quick-search prefill on a fresh start, or the
  // full current profile when resuming/editing from the results screen.
  const [wizardInitial, setWizardInitial] = useState<Partial<WizardProfile> | undefined>(undefined);
  const [wizardStep, setWizardStep] = useState(0); // step the wizard opens on (deep-link from a chip)
  const [editing, setEditing] = useState(false); // entered via an "edit this chip" jump -> show Apply

  // Shareable-link entry: if the URL carries an encoded search (?s=...), jump straight to results.
  useEffect(() => {
    const shared = profileFromUrl();
    if (!shared) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-shot deep-link redirect on mount */
    setProfile(shared);
    setStage("results");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist the active search so a returning visitor can resume it from the landing page.
  const completeWith = (p: WizardProfile) => {
    setProfile(p);
    saveLastSearch(p);
    setStage("results");
  };

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
            <Landing
              onStart={(pre) => {
                setProfile(null);
                setWizardInitial(pre);
                setWizardStep(0);
                setEditing(false);
                setStage("wizard");
              }}
              onAdvanced={() => setStage("chat")}
              onResume={(p) => {
                setProfile(p);
                setStage("results");
              }}
            />
          )}
          {stage === "wizard" && (
            <Wizard
              initial={wizardInitial}
              initialStep={wizardStep}
              editing={editing}
              onHome={() => setStage("landing")}
              onComplete={completeWith}
            />
          )}
          {stage === "results" && profile && (
            <Results
              profile={profile}
              onRestart={() => {
                // Re-walk from the top with the current answers preserved (non-destructive).
                setWizardInitial(profile);
                setWizardStep(0);
                setEditing(false);
                setStage("wizard");
              }}
              onEditStep={(stepIndex) => {
                // Deep-link to one step with answers intact; "Apply" returns straight to results.
                setWizardInitial(profile);
                setWizardStep(stepIndex);
                setEditing(true);
                setStage("wizard");
              }}
            />
          )}
          {stage === "chat" && <Chat onHome={() => setStage("landing")} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
