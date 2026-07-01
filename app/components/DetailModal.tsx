"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { track } from "@vercel/analytics";
import type { AdviceResult, CarIntel, NormalizedListing } from "@/lib/types";
import { recordView } from "@/lib/client-store";
import { estimateOwnershipCost } from "@/lib/ownership-cost";

interface DealerInfo {
  rating: number;
  reviewCount: number;
}

interface VinCheck {
  valid: boolean;
  manufacturer: string | null;
  plantCountry: string | null;
  specMismatch: boolean;
  modelDiffers: boolean;
}

interface PhotoCheck {
  assessment: string;
  hasDamage: boolean;
}

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

  // AI photo damage scan (Wave 5) — keyed per photo index so each shot is scanned independently.
  const [scans, setScans] = useState<Record<number, PhotoCheck>>({});
  const [scanning, setScanning] = useState(false);
  const [scanOff, setScanOff] = useState(false); // feature disabled server-side (needs Upstash)
  async function scanPhoto() {
    if (scanning || scans[idx] || !photos[idx] || scanOff) return;
    setScanning(true);
    try {
      const res = await fetch("/api/photo-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: secure(photos[idx]), year: l.year, make: l.make, model: l.model }),
      });
      if (res.status === 503) {
        setScanOff(true); // server has the feature off — stop offering it
      } else if (res.ok) {
        const data = (await res.json()) as PhotoCheck;
        setScans((s) => ({ ...s, [idx]: data }));
      }
    } catch {
      /* leave unscanned; the button stays available to retry */
    } finally {
      setScanning(false);
    }
  }
  const scan = scans[idx];

  // Log this car as recently viewed (Wave 4 stickiness — localStorage, no backend).
  useEffect(() => {
    recordView(l);
    track("listing_opened", { source: l.source }); // funnel: user engaged with a specific car
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

  // Dealer reputation (Google Places) — no-ops to null when the API key isn't configured.
  const [dealer, setDealer] = useState<DealerInfo | null>(null);
  useEffect(() => {
    if (!l.dealer_name) return;
    let cancelled = false;
    const q = new URLSearchParams({ name: l.dealer_name });
    if (l.dealer_city) q.set("city", l.dealer_city);
    if (l.dealer_state) q.set("state", l.dealer_state);
    fetch(`/api/dealer-info?${q.toString()}`)
      .then((r) => r.json())
      .then((d: DealerInfo | null) => {
        if (!cancelled && d && typeof d.rating === "number") setDealer(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [l.dealer_name, l.dealer_city, l.dealer_state]);

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
        className="md-card max-h-[95dvh] w-full max-w-2xl overflow-y-auto"
        style={{ background: "var(--md-surface-container)", border: "1px solid var(--md-outline-variant)" }}
      >
        {/* photo */}
        <div
          className="relative h-64 w-full overflow-hidden rounded-t-[28px] md:h-80"
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
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-lg shadow-md backdrop-blur-sm"
                style={{ background: "color-mix(in srgb, var(--md-surface-container-highest) 70%, transparent)", color: "var(--md-on-surface)" }}
              >
                ‹
              </button>
              <button
                onClick={() => setIdx((i) => (i + 1) % photos.length)}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-lg shadow-md backdrop-blur-sm"
                style={{ background: "color-mix(in srgb, var(--md-surface-container-highest) 70%, transparent)", color: "var(--md-on-surface)" }}
              >
                ›
              </button>
              <span
                className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md"
                style={{ background: "color-mix(in srgb, var(--md-surface-container-lowest) 60%, transparent)", color: "var(--md-on-surface)" }}
              >
                {idx + 1} / {photos.length}
              </span>
            </>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-sm"
            style={{ background: "color-mix(in srgb, var(--md-surface-container-highest) 80%, transparent)", color: "var(--md-on-surface)" }}
          >
            ✕
          </button>
          {photos.length > 0 && !scanOff && (
            <button
              onClick={scanPhoto}
              disabled={scanning || !!scan}
              className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg backdrop-blur-sm disabled:opacity-70"
              style={{ background: "color-mix(in srgb, var(--md-surface-container-highest) 85%, transparent)", color: "var(--md-on-surface)" }}
            >
              {scanning ? "🔎 Scanning…" : scan ? "✓ Scanned" : "🔎 Scan photo for damage"}
            </button>
          )}
        </div>

        {/* AI photo-scan result (Wave 5) */}
        {scan && (
          <div
            className="flex items-start gap-2 px-6 py-3 text-sm md:px-8"
            style={
              scan.hasDamage
                ? { background: "color-mix(in srgb, var(--md-tertiary) 12%, transparent)", color: "var(--md-tertiary)" }
                : { background: "color-mix(in srgb, var(--md-primary) 10%, transparent)", color: "var(--md-primary)" }
            }
          >
            <span aria-hidden>{scan.hasDamage ? "⚠️" : "✓"}</span>
            <span>
              <span className="font-bold">AI photo scan: </span>
              {scan.assessment}
              <span className="ml-1 opacity-70" style={{ color: "var(--md-on-surface-variant)" }}>
                (always inspect in person)
              </span>
            </span>
          </div>
        )}

        <div className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h2 className="text-2xl font-bold leading-tight md:text-3xl">{l.title || "Vehicle"}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--md-on-surface-variant)" }}>
                <span>{SOURCE_LABEL[l.source] ?? l.source}</span>
                {l.dealer_name && <span className="h-1 w-1 rounded-full" style={{ background: "var(--md-outline-variant)" }} />}
                {l.dealer_name && <span className="truncate">{l.dealer_name}</span>}
                {dealer && (
                  <span style={{ color: "var(--md-tertiary)" }} title={`${dealer.reviewCount.toLocaleString()} Google reviews`}>
                    ★ {dealer.rating.toFixed(1)} ({dealer.reviewCount.toLocaleString()})
                  </span>
                )}
                {l.distance_miles != null && <span className="h-1 w-1 rounded-full" style={{ background: "var(--md-outline-variant)" }} />}
                {l.distance_miles != null && <span>{l.distance_miles} mi away</span>}
                <span className="h-1 w-1 rounded-full" style={{ background: "var(--md-outline-variant)" }} />
                <span style={{ color: "var(--md-primary)" }}>★ Match {l.value_score}/100</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold md:text-3xl" style={{ color: "var(--md-primary)" }}>
                {l.price != null ? `$${l.price.toLocaleString()}` : "—"}
              </div>
            </div>
          </div>

          {l.cpo && (
            <div
              className="flex items-start gap-3 rounded-lg p-4 text-sm"
              style={{ background: "color-mix(in srgb, var(--md-primary) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--md-primary) 22%, transparent)", color: "var(--md-primary)" }}
            >
              <span aria-hidden>✓</span>
              <span>
                <span className="font-bold">Certified Pre-Owned.</span> This listing is marked CPO —
                a manufacturer-backed warranty extension may apply. Confirm the exact coverage and
                terms with the dealer.
              </span>
            </div>
          )}

          {l.deal && (
            <div
              className="flex items-center gap-3 rounded-lg p-4 text-sm font-bold"
              style={
                l.deal.tier === "great"
                  ? { background: "color-mix(in srgb, var(--md-primary) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--md-primary) 22%, transparent)", color: "var(--md-primary)" }
                  : l.deal.tier === "high"
                    ? { background: "color-mix(in srgb, var(--md-error) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--md-error) 22%, transparent)", color: "var(--md-error)" }
                    : { background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }
              }
            >
              {l.deal.tier === "great"
                ? `💰 Great price — $${Math.abs(l.deal.deltaVsMedian).toLocaleString()} below similar listings`
                : l.deal.tier === "high"
                  ? `Above market — $${Math.abs(l.deal.deltaVsMedian).toLocaleString()} more than similar listings`
                  : "Priced in line with similar listings"}
            </div>
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
            {intel?.evRange ? <EVRangeCalc evRange={intel.evRange} bodyStyle={l.body_style} /> : null}
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

          {/* VIN verification + free title-history deep link (Wave 5) */}
          <VinHistory listing={l} />

          {/* financing calculator (Wave 3) */}
          {l.price != null && l.price > 0 && <FinanceCalc price={l.price} />}

          {/* 5-year cost of ownership + depreciation (Wave 5) */}
          {l.price != null && l.price > 0 && (
            <FiveYearCost
              price={l.price}
              make={l.make}
              bodyStyle={l.body_style}
              annualFuelCost={intel?.annualFuelCost ?? null}
            />
          )}

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
            onClick={() => track("outbound_click", { source: l.source })}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-bold uppercase tracking-wide shadow-lg"
            style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
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
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-bold uppercase tracking-wide"
            style={{
              background: "var(--md-surface-container-highest)",
              color: "var(--md-on-surface)",
              border: "1px solid var(--md-outline-variant)",
            }}
          >
            🔍 Search the web
          </a>
          <ShareCar listing={l} />
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
  const [mode, setMode] = useState<"finance" | "lease">("finance");
  const [down, setDown] = useState(Math.round(price * 0.1));
  const [apr, setApr] = useState(7.5);
  const [term, setTerm] = useState(60);
  // Lease-only inputs
  const [residualPct, setResidualPct] = useState(50);
  const [moneyFactor, setMoneyFactor] = useState(0.0025);
  const [leaseTerm, setLeaseTerm] = useState(36);

  const financeMonthly = useMemo(() => {
    const principal = Math.max(0, price - down);
    const r = apr / 100 / 12;
    if (principal <= 0) return 0;
    if (r === 0) return principal / term;
    return (principal * r) / (1 - Math.pow(1 + r, -term));
  }, [price, down, apr, term]);

  const leaseMonthly = useMemo(() => {
    const residual = price * (residualPct / 100);
    const cap = Math.max(0, price - down);
    // Standard lease math: depreciation fee + rent (finance) charge.
    const depreciation = (cap - residual) / leaseTerm;
    const rent = (cap + residual) * moneyFactor;
    return Math.max(0, depreciation + rent);
  }, [price, down, residualPct, moneyFactor, leaseTerm]);

  const field = "md-field w-full px-2 py-1 text-sm";
  const tab = (active: boolean): React.CSSProperties =>
    active
      ? { background: "var(--md-cta)", color: "var(--md-on-cta)" }
      : { background: "var(--md-surface-container-highest)", color: "var(--md-on-surface-variant)" };

  return (
    <details className="mt-4 rounded-2xl p-3 text-sm" style={{ background: "var(--md-surface-container-high)" }}>
      <summary className="cursor-pointer font-bold">💳 Payment estimate</summary>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setMode("finance")} className="flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-wide" style={tab(mode === "finance")}>
          Finance
        </button>
        <button type="button" onClick={() => setMode("lease")} className="flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-wide" style={tab(mode === "lease")}>
          Lease
        </button>
      </div>

      {mode === "finance" ? (
        <>
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
              ${financeMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}> /mo · est. loan payment</span>
          </p>
          <p className="text-center text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
            Estimate only — excludes taxes, fees &amp; insurance.
          </p>
        </>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>Down / drive-off</span>
              <input type="number" min={0} max={price} value={down} onChange={(e) => setDown(Math.min(price, Math.max(0, Number(e.target.value))))} className={field} />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>Lease term (mo)</span>
              <input type="number" min={12} max={60} step={6} value={leaseTerm} onChange={(e) => setLeaseTerm(Math.max(12, Number(e.target.value)))} className={field} />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>Residual %</span>
              <input type="number" min={20} max={80} step={1} value={residualPct} onChange={(e) => setResidualPct(Math.min(80, Math.max(20, Number(e.target.value))))} className={field} />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>Money factor</span>
              <input type="number" min={0} max={0.02} step={0.0001} value={moneyFactor} onChange={(e) => setMoneyFactor(Math.max(0, Number(e.target.value)))} className={field} />
            </label>
          </div>
          <p className="mt-3 text-center">
            <span className="text-2xl font-black" style={{ color: "var(--md-primary)" }}>
              ${leaseMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}> /mo · est. lease payment</span>
          </p>
          <p className="text-center text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
            Rough estimate — leasing used cars is uncommon; residual &amp; money factor vary by lender.
            Money factor ≈ APR ÷ 2400 ({(moneyFactor * 2400).toFixed(1)}% APR equiv).
          </p>
        </>
      )}
    </details>
  );
}

// ---- Wave 5: 5-year cost of ownership + depreciation indicator -----------------------------

function FiveYearCost({
  price,
  make,
  bodyStyle,
  annualFuelCost,
}: {
  price: number;
  make: string | null;
  bodyStyle: string | null;
  annualFuelCost: number | null;
}) {
  const est = useMemo(
    () => estimateOwnershipCost({ price, make, bodyStyle, annualFuelCost }),
    [price, make, bodyStyle, annualFuelCost],
  );
  const retainedPct = Math.round((est.residualValue / price) * 100);
  // Color the resale outlook by annual depreciation: low = holds value, high = sheds it.
  const depColor =
    est.depreciationRate <= 0.1
      ? "var(--md-primary)"
      : est.depreciationRate <= 0.13
        ? "var(--md-tertiary)"
        : "var(--md-error)";
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  // These four rows are exactly what sums to `est.total` — so the breakdown reconciles.
  const rows: [string, string][] = [
    ["Depreciation (5 yr)", money(est.depreciation)],
    ["Fuel (5 yr)", annualFuelCost ? money(est.fuelTotal) : "—"],
    ["Maintenance (5 yr)", money(est.maintenanceTotal)],
    ["Insurance (5 yr)", money(est.insuranceTotal)],
  ];

  return (
    <details className="mt-4 rounded-2xl p-3 text-sm" style={{ background: "var(--md-surface-container-high)" }}>
      <summary className="cursor-pointer font-bold">📊 5-year cost to own</summary>
      <p className="mt-2 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
        On top of the {money(price)} purchase, over 5 years you&apos;d roughly spend:
      </p>
      <div className="mt-2 space-y-1" style={{ color: "var(--md-on-surface-variant)" }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span>{k}</span>
            <span className="font-medium" style={{ color: "var(--md-on-surface)" }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t pt-3" style={{ borderColor: "var(--md-outline-variant)" }}>
        <span className="font-bold">Est. 5-year cost to own</span>
        <span className="text-2xl font-black" style={{ color: "var(--md-primary)" }}>{money(est.total)}</span>
      </div>
      <p className="mt-2 text-sm" style={{ color: depColor }}>
        Resale outlook: ~{money(est.residualValue)} in 5 years ({retainedPct}% retained).{" "}
        {est.depreciationRate <= 0.1
          ? "Holds value well."
          : est.depreciationRate <= 0.13
            ? "Average depreciation."
            : "Depreciates fast — factor that into resale."}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
        National-average estimate (fuel, maintenance, insurance &amp; depreciation). Your costs vary.
      </p>
    </details>
  );
}

// Share a car via the native share sheet (mobile) or clipboard fallback (desktop).
function ShareCar({ listing: l }: { listing: NormalizedListing }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const title = [l.year, l.make, l.model, l.trim].filter(Boolean).join(" ") || "this car";
    const text = `${title}${l.price != null ? ` — $${l.price.toLocaleString()}` : ""} (found on dascar)`;
    const url = l.listing_url;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      onClick={share}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-bold uppercase tracking-wide"
      style={{
        background: "var(--md-surface-container-highest)",
        color: "var(--md-on-surface)",
        border: "1px solid var(--md-outline-variant)",
      }}
    >
      {copied ? "✓ Link copied" : "📤 Share this car"}
    </button>
  );
}

// ---- Wave 3: AI buying tips (negotiation + inspection) ------------------------------------

function BuyingTips({ listing: l }: { listing: NormalizedListing }) {
  const [tips, setTips] = useState<AdviceResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function load() {
    setState("loading");
    track("buying_tips"); // funnel: deep engagement — user asked for AI negotiation help
    try {
      const res = await fetch("/api/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: l.year, make: l.make, model: l.model, trim: l.trim, price: l.price, mileage: l.mileage, privateSeller: l.source === "ebay" }),
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
      {tips.dealer_message && <DealerMessage message={tips.dealer_message} />}
      <p className="mt-2 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>AI guidance — verify before relying on it.</p>
    </div>
  );
}

// Ready-to-send negotiation opener with copy-to-clipboard (Wave 5 KILLER-3).
function DealerMessage({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (insecure context) — the text is still selectable */
    }
  }
  return (
    <div
      className="mt-3 rounded-xl p-3"
      style={{ background: "var(--md-surface-container-highest)", border: "1px solid color-mix(in srgb, var(--md-primary) 25%, transparent)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--md-primary)" }}>
          💬 Ready-to-send message
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg px-3 py-1 text-xs font-bold"
          style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <p className="leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>{message}</p>
    </div>
  );
}

// ---- Wave 5: EV range commute calculator --------------------------------------------------

function EVRangeCalc({ evRange, bodyStyle }: { evRange: number; bodyStyle: string | null }) {
  const [commute, setCommute] = useState(25); // one-way miles
  const [expanded, setExpanded] = useState(false);
  const [electricRate, setElectricRate] = useState(0.16); // $/kWh US avg
  const [gasPrice, setGasPrice] = useState(3.5); // $/gal for the comparison car

  const roundTrip = commute * 2;
  const usableRange = evRange * 0.8; // ~20% real-world margin off EPA
  const coversFully = usableRange >= roundTrip;
  const chargesPerWeek = coversFully ? 0 : Math.ceil((roundTrip * 5) / usableRange);
  const margin = Math.max(0, Math.round(usableRange - roundTrip));

  // Efficiency varies a lot by class — a truck/SUV EV sips far more per mile than a sedan.
  const b = (bodyStyle ?? "").toLowerCase();
  const miPerKwh = b.includes("truck") || b.includes("van")
    ? 2.2
    : b.includes("suv") || b.includes("crossover")
      ? 3.0
      : 3.8; // sedan / hatch / default
  const kWhPerMile = 1 / miPerKwh;
  const monthlyMiles = roundTrip * 22; // ~22 working days
  const monthlyCharge = monthlyMiles * kWhPerMile * electricRate;
  const monthlyGas = (monthlyMiles / 28) * gasPrice; // vs a 28 mpg gas car
  const savings = Math.round(monthlyGas - monthlyCharge);

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--md-outline-variant)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold" style={{ color: "var(--md-on-surface)" }}>🔌 Will it cover your commute?</span>
        <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>{commute} mi each way</span>
      </div>
      <input
        type="range"
        min={1}
        max={150}
        step={1}
        value={commute}
        onChange={(e) => setCommute(Number(e.target.value))}
        className="w-full"
        aria-label="One-way commute miles"
      />
      <p className="mt-2 text-sm font-semibold" style={{ color: coversFully ? "var(--md-primary)" : "var(--md-tertiary)" }}>
        {coversFully
          ? `✓ One charge covers your ${roundTrip} mi round trip, ${margin} mi to spare.`
          : `⚠ Covers part of it — plan to charge about ${chargesPerWeek}× per week.`}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
        Est. charging: <span className="font-semibold" style={{ color: "var(--md-on-surface)" }}>${Math.round(monthlyCharge)}/mo</span>{" "}
        vs. ${Math.round(monthlyGas)}/mo for a 28 mpg gas car
        {savings > 0 ? (
          <span style={{ color: "var(--md-primary)" }}> → saves ~${savings}/mo</span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-[11px] underline"
        style={{ color: "var(--md-on-surface-variant)" }}
      >
        {expanded ? "Hide rate settings" : "Adjust electricity & gas prices"}
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>Electricity $/kWh</span>
            <input type="number" min={0} max={1} step={0.01} value={electricRate} onChange={(e) => setElectricRate(Math.max(0, Number(e.target.value)))} className="md-field w-full px-2 py-1 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>Gas $/gal</span>
            <input type="number" min={0} max={12} step={0.1} value={gasPrice} onChange={(e) => setGasPrice(Math.max(0, Number(e.target.value)))} className="md-field w-full px-2 py-1 text-sm" />
          </label>
        </div>
      )}
      <p className="mt-1 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
        Based on {evRange} mi EPA range; real-world range varies with temperature &amp; driving style.
      </p>
    </div>
  );
}

// ---- Wave 5: VIN verification + free title-history link ------------------------------------

function VinHistory({ listing: l }: { listing: NormalizedListing }) {
  const [check, setCheck] = useState<VinCheck | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (!l.vin) return;
    let cancelled = false;
    const q = new URLSearchParams({ vin: l.vin });
    if (l.make) q.set("make", l.make);
    if (l.model) q.set("model", l.model);
    if (l.year) q.set("year", String(l.year));
    fetch(`/api/vin-check?${q.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: VinCheck) => {
        if (!cancelled) {
          setCheck(d);
          setState("done");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [l.vin, l.make, l.model, l.year]);

  if (!l.vin) return null;

  const historyUrl = `https://www.vehiclehistory.gov/vnSearch.do?vin=${encodeURIComponent(l.vin)}`;

  return (
    <div className="mt-4 rounded-2xl p-3 text-sm" style={{ background: "var(--md-surface-container-high)" }}>
      <div className="mb-1 font-bold">VIN check</div>
      {state === "loading" && <div style={{ color: "var(--md-on-surface-variant)" }}>Verifying VIN…</div>}
      {state === "error" && (
        <div style={{ color: "var(--md-on-surface-variant)" }}>Couldn&apos;t verify the VIN right now.</div>
      )}
      {state === "done" && check && (
        <ul className="space-y-1" style={{ color: "var(--md-on-surface-variant)" }}>
          {check.specMismatch ? (
            <li style={{ color: "var(--md-error)" }}>
              ⚠️ VIN decodes to a different year or make than the listing claims — verify before buying.
            </li>
          ) : check.valid ? (
            <li style={{ color: "var(--md-primary)" }}>
              ✓ VIN verified{check.manufacturer ? ` — ${check.manufacturer}` : ""}
              {check.plantCountry ? `, built in ${check.plantCountry}` : ""}.
            </li>
          ) : (
            <li style={{ color: "var(--md-tertiary)" }}>⚠️ VIN didn&apos;t cleanly decode — double-check it with the seller.</li>
          )}
          {check.valid && !check.specMismatch && check.modelDiffers && (
            <li>
              ℹ️ Decoded model name differs slightly from the listing — usually just trim/naming, but
              worth a glance.
            </li>
          )}
        </ul>
      )}
      <a
        href={historyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold"
        style={{ color: "var(--md-primary)" }}
      >
        View free title history (salvage, flood, owners) ↗
      </a>
      <p className="mt-1 text-[11px]" style={{ color: "var(--md-on-surface-variant)" }}>
        Opens the free government NMVTIS record at vehiclehistory.gov.
      </p>
    </div>
  );
}
