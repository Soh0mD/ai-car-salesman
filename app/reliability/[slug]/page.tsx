import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuideBySlug, getReliabilityGuides } from "@/lib/reliability";
import { getAnnualMaintenanceCost, getDepreciationRate } from "@/lib/ownership-cost";

// Static per-problem buyer's guide (one page per curated reliability rule). All local data —
// these pages are pre-rendered at build time and cost zero inventory-API quota.

export const dynamicParams = false;

export function generateStaticParams() {
  return getReliabilityGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuideBySlug(slug);
  if (!g) return {};
  const models = g.models.length ? g.models.slice(0, 3).join(", ") : "most models";
  const problem = g.issue.split("—")[0]?.trim() ?? "known reliability problem";
  return {
    title: `${g.yearMin}–${g.yearMax} ${g.make} ${models}: ${problem} | dascar`,
    description: `${g.make} ${models} (${g.yearMin}–${g.yearMax}): ${g.issue}. What used-car buyers should check before purchase.`,
    alternates: { canonical: `/reliability/${slug}` },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuideBySlug(slug);
  if (!g) notFound();

  const modelText = g.models.length ? g.models.join(", ") : "most of the lineup";
  const avoid = g.severity === "avoid";
  const maintenance = getAnnualMaintenanceCost(g.make);
  const retainedPct = Math.round(Math.pow(1 - getDepreciationRate(g.make), 5) * 100);
  const related = getReliabilityGuides().filter((o) => o.make === g.make && o.slug !== g.slug);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <nav className="mb-8 flex flex-wrap gap-2 text-sm">
        <Link href="/" className="font-bold" style={{ color: "var(--md-primary)" }}>
          dascar
        </Link>
        <span style={{ color: "var(--md-on-surface-variant)" }}>/</span>
        <Link href="/reliability" className="font-bold" style={{ color: "var(--md-primary)" }}>
          Reliability guides
        </Link>
      </nav>

      <span
        className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
        style={
          avoid
            ? { background: "color-mix(in srgb, var(--md-error) 14%, transparent)", color: "var(--md-error)" }
            : { background: "color-mix(in srgb, var(--md-tertiary) 16%, transparent)", color: "var(--md-tertiary)" }
        }
      >
        {avoid ? "⛔ Avoid unless documented" : "⚠️ Check before buying"}
      </span>

      <h1 className="md-headline mt-4">
        {g.yearMin}–{g.yearMax} {g.make} {g.models.length ? g.models.slice(0, 3).join(" / ") : ""}
        {g.models.length > 3 ? " (and more)" : ""}: known reliability problem
      </h1>

      <section className="mt-6 rounded-2xl p-5" style={{ background: "var(--md-surface-container)", border: "1px solid var(--md-outline-variant)" }}>
        <h2 className="md-title mb-2 font-bold">The problem</h2>
        <p className="leading-relaxed">{g.issue}.</p>
      </section>

      <section className="mt-4 rounded-2xl p-5" style={{ background: "var(--md-surface-container)", border: "1px solid var(--md-outline-variant)" }}>
        <h2 className="md-title mb-2 font-bold">Vehicles affected</h2>
        <p className="leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
          {g.make} — {modelText}, model years <strong style={{ color: "var(--md-on-surface)" }}>{g.yearMin}–{g.yearMax}</strong>.
          Adjacent years and trims with different engines are generally not affected; the exact
          engine/transmission in the specific car is what matters.
        </p>
      </section>

      <section className="mt-4 rounded-2xl p-5" style={{ background: "var(--md-surface-container)", border: "1px solid var(--md-outline-variant)" }}>
        <h2 className="md-title mb-2 font-bold">What it means for a buyer</h2>
        <p className="leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
          {avoid
            ? "This is a well-documented, expensive failure pattern — the kind that can cost more than the car is worth. Unless the seller can show the failure-prone component was already replaced or repaired under the relevant recall, TSB, or extended warranty, most buyers should simply pick a different car."
            : "This is a real, documented pattern — but often preventable or already addressed. It is a reason to inspect harder and negotiate, not necessarily to walk away: a car with records showing the issue was serviced can still be a good buy."}{" "}
          For context, a {g.make} averages about ${maintenance.toLocaleString()}/year in maintenance
          and typically retains roughly {retainedPct}% of its value after five years.
        </p>
      </section>

      <section className="mt-4 rounded-2xl p-5" style={{ background: "var(--md-surface-container)", border: "1px solid var(--md-outline-variant)" }}>
        <h2 className="md-title mb-2 font-bold">Considering one anyway? Do this</h2>
        <ul className="ml-5 list-disc space-y-1.5 leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
          <li>Ask directly whether the affected component was repaired/replaced, and get the paperwork.</li>
          <li>Get a pre-purchase inspection from an independent mechanic and mention this exact issue.</li>
          <li>
            Check open recalls by VIN at{" "}
            <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--md-primary)" }}>
              nhtsa.gov/recalls
            </a>
            .
          </li>
          <li>
            Pull the free government title history (salvage/flood/odometer) at{" "}
            <a href="https://vehiclehistory.bja.ojp.gov" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--md-primary)" }}>
              the NMVTIS portal
            </a>
            .
          </li>
          <li>Price it against unaffected rivals — this issue is negotiating leverage.</li>
        </ul>
      </section>

      <div
        className="mt-6 rounded-2xl p-6 text-center"
        style={{ background: "var(--md-surface-container)", border: "1px solid color-mix(in srgb, var(--md-cta) 30%, transparent)" }}
      >
        <p className="font-bold">dascar flags this automatically</p>
        <p className="mt-1 text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
          Search live listings with reliability checks, fair-price signals and negotiation help built in.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wide shadow-lg"
          style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
        >
          Search used cars
        </Link>
      </div>

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="md-title mb-3 font-bold">More {g.make} guides</h2>
          <ul className="space-y-2">
            {related.map((o) => (
              <li key={o.slug}>
                <Link href={`/reliability/${o.slug}`} className="underline" style={{ color: "var(--md-primary)" }}>
                  {o.yearMin}–{o.yearMax} {o.models.slice(0, 3).join(", ") || o.make}: {o.issue.split("—")[0]?.trim()}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
        Sources: NHTSA recall and complaint records, manufacturer technical service bulletins and
        warranty extensions, and public class-action settlements. This page describes a documented
        model-wide pattern — it is guidance, not a verdict on any individual vehicle.
      </p>
    </div>
  );
}
