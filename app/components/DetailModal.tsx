"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { NormalizedListing } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  marketcheck: "Dealer listing",
  ebay: "eBay Motors",
  autodev: "Listing",
};

function fmt(n: number | null, suffix = ""): string {
  return n == null ? "—" : `${n.toLocaleString("en-US")}${suffix}`;
}

export function DetailModal({
  listing: l,
  onClose,
}: {
  listing: NormalizedListing;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const photos = l.images.length > 0 ? l.images : [];
  const specs: [string, string][] = [
    ["Year", l.year != null ? String(l.year) : "—"],
    ["Make", l.make ?? "—"],
    ["Model", l.model ?? "—"],
    ["Trim", l.trim ?? "—"],
    ["Mileage", l.mileage != null ? fmt(l.mileage, " mi") : "—"],
    ["Drivetrain", l.drivetrain ?? "—"],
    ["Transmission", l.transmission ?? "—"],
    ["Fuel", l.fuel_type ?? "—"],
    ["Cylinders", l.cylinders != null ? String(l.cylinders) : "—"],
    ["Body style", l.body_style ?? "—"],
    ["VIN", l.vin ?? "—"],
    ["Distance", l.distance_miles != null ? fmt(l.distance_miles, " mi") : "—"],
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <motion.div
        initial={{ y: 40, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="md-card max-h-[92dvh] w-full max-w-lg overflow-y-auto"
        style={{ background: "var(--md-surface-container)" }}
      >
        {/* photo */}
        <div
          className="relative h-56 w-full overflow-hidden rounded-t-[28px]"
          style={{ background: "var(--md-surface-container-high)" }}
        >
          {photos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[idx]} alt={l.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl">🚘</div>
          )}
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
                className="md-btn md-btn-tonal absolute left-2 top-1/2 -translate-y-1/2 !px-3 !py-2"
              >
                ‹
              </button>
              <button
                onClick={() => setIdx((i) => (i + 1) % photos.length)}
                className="md-btn md-btn-tonal absolute right-2 top-1/2 -translate-y-1/2 !px-3 !py-2"
              >
                ›
              </button>
              <span
                className="absolute bottom-2 right-3 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                {idx + 1}/{photos.length}
              </span>
            </>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="md-btn md-btn-tonal absolute right-2 top-2 !px-3 !py-2"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="md-title">{l.title || "Vehicle"}</h2>
            <span className="shrink-0 text-xl font-black" style={{ color: "var(--md-primary)" }}>
              {l.price != null ? `$${l.price.toLocaleString()}` : "—"}
            </span>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--md-on-surface-variant)" }}>
            {SOURCE_LABEL[l.source] ?? l.source}
            {l.dealer_name ? ` · ${l.dealer_name}` : ""} · Value score {l.value_score}
          </p>

          {/* reliability */}
          {(l.reliability_flag || l.recall_count != null || l.complaints) && (
            <div
              className="mt-4 rounded-2xl p-3 text-sm"
              style={{ background: "var(--md-surface-container-high)" }}
            >
              <div className="mb-1 font-bold">Reliability</div>
              <ul className="space-y-1" style={{ color: "var(--md-on-surface-variant)" }}>
                {l.recall_count != null && (
                  <li>
                    {l.recall_count === 0
                      ? "✅ No open NHTSA recalls"
                      : `⚠️ ${l.recall_count} NHTSA recall${l.recall_count === 1 ? "" : "s"}`}
                  </li>
                )}
                {l.complaints && (
                  <li>
                    🗒️ {l.complaints.total.toLocaleString()} NHTSA complaints
                    {l.complaints.powertrain > 0
                      ? ` (${l.complaints.powertrain} powertrain/engine)`
                      : ""}
                  </li>
                )}
                {l.reliability_flag && (
                  <li
                    style={{
                      color:
                        l.reliability_flag.severity === "avoid"
                          ? "var(--md-error)"
                          : "var(--md-on-surface-variant)",
                    }}
                  >
                    {l.reliability_flag.severity === "avoid" ? "⛔ " : "⚠️ "}
                    {l.reliability_flag.issue}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* specs */}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {specs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b py-1" style={{ borderColor: "var(--md-outline-variant)" }}>
                <span style={{ color: "var(--md-on-surface-variant)" }}>{k}</span>
                <span className="truncate text-right font-medium">{v}</span>
              </div>
            ))}
          </div>

          <a
            href={l.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="md-btn md-btn-filled mt-5 w-full"
          >
            View original listing ↗
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
