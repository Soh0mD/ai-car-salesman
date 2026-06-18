"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { AdviceResult, CarIntel, NormalizedListing } from "@/lib/types";
import { recordView } from "@/lib/client-store";

// Upgrade http -> https so photos aren't blocked as mixed content on the https site.
const secure = (url: string) => url.replace(/^http:\/\//i, "https://");

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

  // Log this car as recently viewed (Wave 4 stickiness — localStorage, no backend).
  useEffect(() => {
    recordView(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch running-cost + safety on demand (only for the car the user actually opened).
  const [intel, setIntel] = useState<CarIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(!!(l.make && l.model && l.year));
  useEffect(() => {
    if (!l.make || !l.model || !l.year) return;
    let cancelled = false;
    const q = new URLSearchParams({ make: l.make, model: l.model, year: String(l.year) });
    fetch(`/api/car-intel?${q.toString()}`)
      .then((r) => r.json())
      .then((d: CarIntel) => {
        if (!cancelled) setIntel(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIntelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [l.make, l.model, l.year]);

  // Close on Escape, and lock background scroll while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
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
            <img src={secure(photos[idx])} alt={l.title} className="h-full w-full object-cover" />
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
            {l.dealer_name ? ` · ${l.dealer_name}` : ""} · Match {l.value_score}/100
          </p>
          {l.deal && (
            <p
              className="mt-2 text-sm font-semibold"
              style={{
                color:
                  l.deal.tier === "great"
                    ? "var(--md-primary)"
                    : l.deal.tier === "high"
                      ? "var(--md-error)"
                      : "var(--md-on-surface-variant)",
              }}
            >
              {l.deal.tier === "great"
                ? `💰 Great price — $${Math.abs(l.deal.deltaVsMedian).toLocaleString()} below similar listings`
                : l.deal.tier === "high"
                  ? `Above market — $${Math.abs(l.deal.deltaVsMedian).toLocaleString()} more than similar listings`
                  : "Priced in line with similar listings"}
            </p>
          )}

          {/* running costs + safety (fetched on demand) */}
          <div
            className="mt-4 rounded-2xl p-3 text-sm"
            style={{ background: "var(--md-surface-container-high)" }}
          >
            <div className="mb-1 font-bold">Running costs &amp; safety</div>
            {intelLoading ? (
              <div style={{ color: "var(--md-on-surface-variant)" }}>
                Checking EPA fuel economy &amp; NHTSA safety…
              </div>
            ) : intel &&
              (intel.mpg || intel.annualFuelCost || intel.evRange || intel.safety?.overall) ? (
              <ul className="space-y-1" style={{ color: "var(--md-on-surface-variant)" }}>
                {intel.mpg && <li>⛽ {intel.mpg} MPG combined (EPA)</li>}
                {intel.annualFuelCost && (
                  <li>💵 ~${intel.annualFuelCost.toLocaleString()}/yr estimated fuel cost</li>
                )}
                {intel.evRange ? <li>🔋 {intel.evRange} mi EPA range</li> : null}
                {intel.safety?.overall && (
                  <li>
                    🛡️ {intel.safety.overall}/5 NHTSA overall safety
                    {intel.safety.rollover ? ` · rollover ${intel.safety.rollover}/5` : ""}
                  </li>
                )}
              </ul>
            ) : (
              <div style={{ color: "var(--md-on-surface-variant)" }}>
                No EPA/NHTSA data for this model.
              </div>
            )}
          </div>

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

          {/* financing calculator (Wave 3) */}
          {l.price != null && l.price > 0 && <FinanceCalc price={l.price} />}

          {/* buying tips (Wave 3) */}
          <BuyingTips listing={l} />

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
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(
              [l.year, l.make, l.model, l.trim].filter(Boolean).join(" ") +
                (l.vin ? ` ${l.vin}` : "") +
                " for sale",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="md-btn md-btn-tonal mt-2 w-full"
          >
            🔍 Search the web for this car
          </a>
          <p
            className="mt-2 text-center text-xs"
            style={{ color: "var(--md-on-surface-variant)" }}
          >
            Used listings sell fast — if the original is gone, the search above will find it (or
            one just like it).
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- Wave 3: financing calculator (pure client math) --------------------------------------

function FinanceCalc({ price }: { price: number }) {
  const [down, setDown] = useState(Math.round(price * 0.1));
  const [apr, setApr] = useState(7.5);
  const [term, setTerm] = useState(60);

  const monthly = useMemo(() => {
    const principal = Math.max(0, price - down);
    const r = apr / 100 / 12;
    if (principal <= 0) return 0;
    if (r === 0) return principal / term;
    return (principal * r) / (1 - Math.pow(1 + r, -term));
  }, [price, down, apr, term]);

  const field = "md-field w-full px-2 py-1 text-sm";
  return (
    <details className="mt-4 rounded-2xl p-3 text-sm" style={{ background: "var(--md-surface-container-high)" }}>
      <summary className="cursor-pointer font-bold">💳 Monthly payment estimate</summary>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>Down payment</span>
          <input type="number" min={0} max={price} value={down} onChange={(e) => setDown(Math.min(price, Math.max(0, Number(e.target.value))))} className={field} />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>APR %</span>
          <input type="number" min={0} max={30} step={0.1} value={apr} onChange={(e) => setApr(Math.max(0, Number(e.target.value)))} className={field} />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>Term (mo)</span>
          <input type="number" min={12} max={84} step={6} value={term} onChange={(e) => setTerm(Math.max(12, Number(e.target.value)))} className={field} />
        </label>
      </div>
      <p className="mt-3 text-center">
        <span className="text-2xl font-black" style={{ color: "var(--md-primary)" }}>
          ${monthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
        <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}> /mo · est.</span>
      </p>
      <p className="text-center text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
        Estimate only — excludes taxes, fees &amp; insurance.
      </p>
    </details>
  );
}

// ---- Wave 3: AI buying tips (negotiation + inspection) ------------------------------------

function BuyingTips({ listing: l }: { listing: NormalizedListing }) {
  const [tips, setTips] = useState<AdviceResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function load() {
    setState("loading");
    try {
      const res = await fetch("/api/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: l.year, make: l.make, model: l.model, trim: l.trim, price: l.price, mileage: l.mileage }),
      });
      if (!res.ok) throw new Error();
      setTips((await res.json()) as AdviceResult);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  if (!l.make || !l.model) return null;

  if (!tips)
    return (
      <button
        type="button"
        onClick={load}
        disabled={state === "loading"}
        className="md-btn md-btn-tonal mt-4 w-full"
      >
        {state === "loading" ? "Thinking…" : state === "error" ? "Try again" : "🧠 Get buying tips"}
      </button>
    );

  return (
    <div className="mt-4 rounded-2xl p-3 text-sm" style={{ background: "var(--md-surface-container-high)" }}>
      <div className="mb-1 font-bold">🧠 Buying tips</div>
      {tips.summary && <p className="mb-2" style={{ color: "var(--md-on-surface-variant)" }}>{tips.summary}</p>}
      {tips.fair_offer_low != null && tips.fair_offer_high != null && (
        <p className="mb-2 font-semibold" style={{ color: "var(--md-primary)" }}>
          Target offer: ${tips.fair_offer_low.toLocaleString()}–${tips.fair_offer_high.toLocaleString()}
        </p>
      )}
      {tips.inspect.length > 0 && (
        <>
          <div className="mt-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--md-on-surface-variant)" }}>What to inspect</div>
          <ul className="ml-4 list-disc space-y-0.5" style={{ color: "var(--md-on-surface-variant)" }}>
            {tips.inspect.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}
      {tips.questions.length > 0 && (
        <>
          <div className="mt-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--md-on-surface-variant)" }}>Ask the seller</div>
          <ul className="ml-4 list-disc space-y-0.5" style={{ color: "var(--md-on-surface-variant)" }}>
            {tips.questions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}
      <p className="mt-2 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>AI guidance — verify before relying on it.</p>
    </div>
  );
}
