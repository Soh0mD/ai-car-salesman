import type { NormalizedListing } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  marketcheck: "Dealer",
  ebay: "eBay Motors",
  autodev: "Listing",
};

function money(n: number | null): string {
  return n == null ? "—" : `$${n.toLocaleString("en-US")}`;
}

function miles(n: number | null): string {
  return n == null ? "" : `${n.toLocaleString("en-US")} mi`;
}

type Tone = "neutral" | "value" | "good" | "warn" | "danger";

const TONE_STYLE: Record<Tone, React.CSSProperties> = {
  neutral: {
    background: "var(--md-surface-container-high)",
    color: "var(--md-on-surface-variant)",
  },
  value: { background: "var(--md-tertiary-container)", color: "var(--md-on-tertiary-container)" },
  good: { background: "var(--md-primary-container)", color: "var(--md-on-primary-container)" },
  warn: { background: "var(--md-warn-container)", color: "var(--md-on-warn-container)" },
  danger: { background: "var(--md-error-container)", color: "var(--md-on-error-container)" },
};

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className="md-badge" style={TONE_STYLE[tone]}>
      {children}
    </span>
  );
}

export function ListingCard({
  listing: l,
  onSelect,
}: {
  listing: NormalizedListing;
  onSelect: (listing: NormalizedListing) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(l)}
      className="md-card md-card-outlined md-card-link flex w-full gap-4 p-3 text-left"
    >
      <div
        className="h-24 w-32 shrink-0 overflow-hidden rounded-2xl"
        style={{ background: "var(--md-surface-container-high)" }}
      >
        {l.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image_url} alt={l.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🚘</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">{l.title || "Vehicle"}</h3>
          <span className="shrink-0 text-sm font-bold" style={{ color: "var(--md-primary)" }}>
            {money(l.price)}
          </span>
        </div>

        <div
          className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs"
          style={{ color: "var(--md-on-surface-variant)" }}
        >
          {l.mileage != null && <span>{miles(l.mileage)}</span>}
          {l.drivetrain && <span>{l.drivetrain}</span>}
          {l.transmission && <span>{l.transmission}</span>}
          {l.distance_miles != null && <span>{l.distance_miles} mi away</span>}
          {l.dealer_name && <span className="truncate">{l.dealer_name}</span>}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge>{SOURCE_LABEL[l.source] ?? l.source}</Badge>
          <Badge tone="value">Value {l.value_score}</Badge>
          {l.reliability_flag && (
            <Badge tone={l.reliability_flag.severity === "avoid" ? "danger" : "warn"}>
              {l.reliability_flag.severity === "avoid" ? "⚠ Known issue" : "Heads up"}
            </Badge>
          )}
          {l.recall_count != null &&
            (l.recall_count === 0 ? (
              <Badge tone="good">No open recalls</Badge>
            ) : (
              <Badge tone="warn">
                {l.recall_count} recall{l.recall_count === 1 ? "" : "s"}
              </Badge>
            ))}
          {l.complaints && l.complaints.total > 0 && (
            <Badge tone={l.complaints.powertrain >= 150 ? "warn" : "neutral"}>
              {l.complaints.total} complaints
              {l.complaints.powertrain > 0 ? ` · ${l.complaints.powertrain} powertrain` : ""}
            </Badge>
          )}
        </div>

        {l.reliability_flag && (
          <p
            className="mt-1.5 text-xs"
            style={{
              color:
                l.reliability_flag.severity === "avoid"
                  ? "var(--md-error)"
                  : "var(--md-on-surface-variant)",
            }}
          >
            {l.reliability_flag.issue}
          </p>
        )}
      </div>
    </button>
  );
}
