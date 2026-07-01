import type { Metadata } from "next";
import Link from "next/link";
import { getReliabilityGuides } from "@/lib/reliability";

// Static hub for the reliability guides — pure local data, indexable, zero API quota.

export const metadata: Metadata = {
  title: "Used car reliability guides — known problems by make & model | dascar",
  description:
    "Documented engine and transmission problems to know before you buy: Nissan CVTs, Hyundai/Kia Theta II, Ford PowerShift, BMW N54/N63 and more — with the exact model years affected.",
  alternates: { canonical: "/reliability" },
};

export default function ReliabilityHub() {
  const guides = getReliabilityGuides();
  const byMake = new Map<string, typeof guides>();
  for (const g of guides) {
    const list = byMake.get(g.make) ?? [];
    list.push(g);
    byMake.set(g.make, list);
  }
  const makes = [...byMake.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/" className="font-bold" style={{ color: "var(--md-primary)" }}>
          ← dascar home
        </Link>
      </nav>

      <h1 className="md-headline">Used car reliability guides</h1>
      <p className="mt-3 leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
        The failure-prone engines and transmissions every used-car shopper should know about —
        compiled from NHTSA recalls and investigations, class-action settlements, manufacturer
        service bulletins and warranty extensions. dascar checks every search result against this
        list automatically, so the lemons get flagged before you fall for one.
      </p>

      <div className="mt-8 space-y-8">
        {makes.map((make) => (
          <section key={make}>
            <h2 className="md-title mb-3 text-lg font-bold">{make}</h2>
            <ul className="space-y-2">
              {byMake.get(make)!.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/reliability/${g.slug}`}
                    className="flex flex-wrap items-baseline gap-2 rounded-xl p-3 transition-colors"
                    style={{ background: "var(--md-surface-container)", border: "1px solid var(--md-outline-variant)" }}
                  >
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={
                        g.severity === "avoid"
                          ? { background: "color-mix(in srgb, var(--md-error) 14%, transparent)", color: "var(--md-error)" }
                          : { background: "color-mix(in srgb, var(--md-tertiary) 16%, transparent)", color: "var(--md-tertiary)" }
                      }
                    >
                      {g.severity === "avoid" ? "Avoid" : "Caution"}
                    </span>
                    <span className="font-semibold">
                      {g.models.length ? g.models.slice(0, 4).join(", ") : "Most models"}
                      {g.models.length > 4 ? "…" : ""} ({g.yearMin}–{g.yearMax})
                    </span>
                    <span className="text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
                      {g.issue.split("—")[0]?.trim()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div
        className="mt-10 rounded-2xl p-6 text-center"
        style={{ background: "var(--md-surface-container)", border: "1px solid color-mix(in srgb, var(--md-cta) 30%, transparent)" }}
      >
        <p className="font-bold">Shopping for a used car?</p>
        <p className="mt-1 text-sm" style={{ color: "var(--md-on-surface-variant)" }}>
          dascar searches live listings and flags every one of these problems automatically.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wide shadow-lg"
          style={{ background: "var(--md-cta)", color: "var(--md-on-cta)" }}
        >
          Start a search
        </Link>
      </div>

      <p className="mt-8 text-xs leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
        These guides describe documented, model-wide patterns — they are guidance, not a verdict on
        any individual car. A well-maintained example with records can outlive the statistics;
        always get a pre-purchase inspection.
      </p>
    </div>
  );
}
