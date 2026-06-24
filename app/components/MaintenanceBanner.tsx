"use client";

import { useEffect, useState } from "react";

/**
 * Slim top banner shown when no live inventory source is available (e.g. the Marketcheck monthly
 * quota is exhausted). It polls /api/health and hides itself automatically once a source is back —
 * no manual toggling. While sources are down the health probe is essentially free (a 429 doesn't
 * consume Marketcheck quota), so polling is safe.
 */
export function MaintenanceBanner() {
  const [info, setInfo] = useState<{ ok: boolean; reason: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((d: { ok: boolean; reason: string }) => {
          if (alive) setInfo(d);
        })
        .catch(() => {});
    check();
    const id = setInterval(check, 5 * 60 * 1000); // re-check every 5 min so it auto-clears on recovery
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!info || info.ok) return null;

  return (
    <div
      role="alert"
      className="w-full px-4 py-2.5 text-center text-sm font-semibold"
      style={{
        background: "color-mix(in srgb, var(--md-tertiary) 18%, var(--md-surface))",
        color: "var(--md-on-surface)",
        borderBottom: "1px solid color-mix(in srgb, var(--md-tertiary) 40%, transparent)",
      }}
    >
      <span aria-hidden>⚠️ </span>
      {info.reason || "dascar's live inventory is temporarily unavailable — searches may come back empty right now."}
    </div>
  );
}
