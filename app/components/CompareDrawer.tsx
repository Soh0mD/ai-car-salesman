"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import type { NormalizedListing } from "@/lib/types";

const secure = (url: string) => url.replace(/^http:\/\//i, "https://");

function money(n: number | null) {
  return n == null ? "—" : `$${n.toLocaleString("en-US")}`;
}
function miles(n: number | null) {
  return n == null ? "—" : `${n.toLocaleString("en-US")} mi`;
}

/** Highlight the best value in a numeric row (lowest price/miles/distance, highest match/year). */
function bestIndex(vals: (number | null)[], dir: "min" | "max"): number {
  let bi = -1;
  let bv = dir === "min" ? Infinity : -Infinity;
  vals.forEach((v, i) => {
    if (v == null) return;
    if ((dir === "min" && v < bv) || (dir === "max" && v > bv)) {
      bv = v;
      bi = i;
    }
  });
  return bi;
}

export function CompareDrawer({
  listings,
  onClose,
  onRemove,
}: {
  listings: NormalizedListing[];
  onClose: () => void;
  onRemove: (l: NormalizedListing) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const rows: { label: string; values: (string | number)[]; best?: number }[] = [
    { label: "Price", values: listings.map((l) => money(l.price)), best: bestIndex(listings.map((l) => l.price), "min") },
    { label: "Match", values: listings.map((l) => `${l.value_score}/100`), best: bestIndex(listings.map((l) => l.value_score), "max") },
    {
      label: "Deal",
      values: listings.map((l) =>
        l.deal ? (l.deal.tier === "great" ? "Great" : l.deal.tier === "high" ? "Above mkt" : "Fair") : "—",
      ),
    },
    { label: "Mileage", values: listings.map((l) => miles(l.mileage)), best: bestIndex(listings.map((l) => l.mileage), "min") },
    { label: "Year", values: listings.map((l) => l.year ?? "—"), best: bestIndex(listings.map((l) => l.year), "max") },
    { label: "Drivetrain", values: listings.map((l) => l.drivetrain ?? "—") },
    { label: "Transmission", values: listings.map((l) => l.transmission ?? "—") },
    { label: "Fuel", values: listings.map((l) => l.fuel_type ?? "—") },
    { label: "Distance", values: listings.map((l) => (l.distance_miles != null ? `${l.distance_miles} mi` : "—")) },
    {
      label: "Recalls",
      values: listings.map((l) => (l.recall_count == null ? "—" : l.recall_count === 0 ? "None" : String(l.recall_count))),
    },
    {
      label: "Known issue",
      values: listings.map((l) => (l.reliability_flag ? (l.reliability_flag.severity === "avoid" ? "⛔ Yes" : "⚠️ Caution") : "None")),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="md-card max-h-[92dvh] w-full max-w-3xl overflow-auto p-5"
        style={{ background: "var(--md-surface-container)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="md-title">Compare {listings.length} cars</h2>
          <button onClick={onClose} aria-label="Close" className="md-btn md-btn-tonal !px-3 !py-2">
            ✕
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-24" />
                {listings.map((l) => (
                  <th key={l.listing_url} className="p-2 align-top">
                    <div
                      className="mx-auto mb-1 h-16 w-24 overflow-hidden rounded-xl"
                      style={{ background: "var(--md-surface-container-high)" }}
                    >
                      {l.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={secure(l.image_url)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl">🚘</div>
                      )}
                    </div>
                    <div className="line-clamp-2 text-xs font-semibold">{l.title || "Vehicle"}</div>
                    <button
                      onClick={() => onRemove(l)}
                      className="mt-1 text-[11px] font-semibold"
                      style={{ color: "var(--md-error)" }}
                    >
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} style={{ borderTop: "1px solid var(--md-outline-variant)" }}>
                  <td className="py-2 pr-2 font-semibold" style={{ color: "var(--md-on-surface-variant)" }}>
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className="p-2 text-center font-medium"
                      style={
                        row.best === i
                          ? { color: "var(--md-primary)", fontWeight: 800 }
                          : { color: "var(--md-on-surface)" }
                      }
                    >
                      {v}
                      {row.best === i ? " ★" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
