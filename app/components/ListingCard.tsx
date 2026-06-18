import type { DealInfo, NormalizedListing } from "@/lib/types";

function dealText(d: DealInfo): string {
  const amt = `$${Math.abs(d.deltaVsMedian).toLocaleString("en-US")}`;
  if (d.tier === "great") return `💰 ${amt} below similar`;
  if (d.tier === "high") return `${amt} above similar`;
  return "Priced like similar";
}

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

// Upgrade http -> https so images aren't blocked as mixed content on the https site.
function secure(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
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

function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span className="md-badge" style={TONE_STYLE[tone]} title={title}>
      {children}
    </span>
  );
}

export function ListingCard({
  listing: l,
  onSelect,
  isFavorite = false,
  onToggleFavorite,
  comparing = false,
  onToggleCompare,
  compareDisabled = false,
}: {
  listing: NormalizedListing;
  onSelect: (listing: NormalizedListing) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (listing: NormalizedListing) => void;
  comparing?: boolean;
  onToggleCompare?: (listing: NormalizedListing) => void;
  compareDisabled?: boolean;
}) {
  return (
    <div className="relative">
      {/* overlaid actions over the photo — kept outside the <button> so we never nest buttons */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
        {onToggleFavorite && (
          <button
            type="button"
            aria-label={isFavorite ? "Remove from saved" : "Save car"}
            title={isFavorite ? "Saved — click to remove" : "Save this car"}
            onClick={() => onToggleFavorite(l)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-sm"
            style={{
              background: "var(--md-surface-container-lowest)",
              color: isFavorite ? "var(--md-error)" : "var(--md-on-surface-variant)",
            }}
          >
            {isFavorite ? "♥" : "♡"}
          </button>
        )}
        {onToggleCompare && (
          <button
            type="button"
            aria-label={comparing ? "Remove from compare" : "Add to compare"}
            title={comparing ? "Remove from compare" : "Compare this car (up to 4)"}
            onClick={() => onToggleCompare(l)}
            disabled={compareDisabled && !comparing}
            className="flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-sm"
            style={{
              cursor: compareDisabled && !comparing ? "not-allowed" : "pointer",
              opacity: compareDisabled && !comparing ? 0.4 : 1,
              ...(comparing
                ? { background: "var(--md-primary)", color: "var(--md-on-primary)" }
                : { background: "var(--md-surface-container-lowest)", color: "var(--md-on-surface-variant)" }),
            }}
          >
            {comparing ? "✓" : "⇄"}
          </button>
        )}
      </div>

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
            <img
              src={secure(l.image_url)}
              alt={l.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
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
          {l.deal && (
            <Badge
              tone={l.deal.tier === "great" ? "good" : l.deal.tier === "high" ? "warn" : "neutral"}
              title="This car's price vs. similar listings in your results"
            >
              {dealText(l.deal)}
            </Badge>
          )}
          <Badge
            tone="value"
            title="Match: how well it fits your search — price, distance, mileage & reliability"
          >
            Match {l.value_score}
          </Badge>
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
    </div>
  );
}
