import type { DealInfo, NormalizedListing } from "@/lib/types";

// Ported from the Stitch "Search Results — Teal & Timber" card: wide photo on the left,
// details on the right, favorite/compare overlaid on the image, rounded-lg tinted badges.

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
function secure(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

type Tone = "deal" | "neutral" | "good" | "warn" | "danger";

const TONE: Record<Tone, React.CSSProperties> = {
  deal: {
    background: "color-mix(in srgb, var(--md-primary) 18%, transparent)",
    color: "var(--md-primary)",
    border: "1px solid color-mix(in srgb, var(--md-primary) 25%, transparent)",
  },
  good: {
    background: "color-mix(in srgb, var(--md-primary) 10%, transparent)",
    color: "var(--md-primary)",
    border: "1px solid color-mix(in srgb, var(--md-primary) 22%, transparent)",
  },
  neutral: {
    background: "var(--md-surface-container-highest)",
    color: "var(--md-on-surface-variant)",
  },
  warn: {
    background: "color-mix(in srgb, var(--md-tertiary) 14%, transparent)",
    color: "var(--md-tertiary)",
    border: "1px solid color-mix(in srgb, var(--md-tertiary) 24%, transparent)",
  },
  danger: {
    background: "color-mix(in srgb, var(--md-error) 12%, transparent)",
    color: "var(--md-error)",
    border: "1px solid color-mix(in srgb, var(--md-error) 24%, transparent)",
  },
};

function Badge({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: Tone; title?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
      style={{ borderRadius: "var(--md-corner-md)", ...TONE[tone] }}
      title={title}
    >
      {children}
    </span>
  );
}

function OverlayBtn({
  onClick,
  active,
  activeColor,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-full text-base shadow-md backdrop-blur-sm transition-colors disabled:opacity-40"
      style={{
        background: active && activeColor === "primary" ? "var(--md-cta)" : "color-mix(in srgb, var(--md-surface) 80%, transparent)",
        color: active
          ? activeColor === "error"
            ? "var(--md-error)"
            : "var(--md-on-cta)"
          : "var(--md-on-surface)",
      }}
    >
      {children}
    </button>
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
  const greatDeal = l.deal?.tier === "great";
  const specs = [
    l.mileage != null ? miles(l.mileage) : null,
    l.drivetrain,
    l.distance_miles != null ? `${l.distance_miles} mi away` : null,
    l.dealer_name,
  ].filter(Boolean) as string[];

  return (
    <div className="group relative">
      {/* overlaid actions on the photo */}
      <div className="absolute left-4 top-4 z-10 flex gap-2">
        {onToggleFavorite && (
          <OverlayBtn
            onClick={() => onToggleFavorite(l)}
            active={isFavorite}
            activeColor="error"
            title={isFavorite ? "Saved — click to remove" : "Save this car"}
          >
            {isFavorite ? "♥" : "♡"}
          </OverlayBtn>
        )}
        {onToggleCompare && (
          <OverlayBtn
            onClick={() => onToggleCompare(l)}
            active={comparing}
            activeColor="primary"
            disabled={compareDisabled && !comparing}
            title={comparing ? "Remove from compare" : "Compare this car (up to 4)"}
          >
            {comparing ? "✓" : "⇄"}
          </OverlayBtn>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect(l)}
        className="flex w-full flex-col overflow-hidden text-left transition-all duration-300 md:flex-row"
        style={{
          background: "var(--md-surface-container)",
          border: "1px solid var(--md-outline-variant)",
          borderRadius: "var(--md-corner-lg)",
          boxShadow: "var(--md-elev-1)",
        }}
      >
        <div
          className="relative h-52 w-full shrink-0 overflow-hidden md:h-auto md:w-72"
          style={{ background: "var(--md-surface-container-high)" }}
        >
          {l.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={secure(l.image_url)}
              alt={l.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">🚘</div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold leading-snug">{l.title || "Vehicle"}</h3>
              <span
                className="shrink-0 text-2xl font-bold"
                style={{ color: greatDeal ? "var(--md-primary)" : "var(--md-on-surface)" }}
              >
                {money(l.price)}
              </span>
            </div>
            <div
              className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "var(--md-on-surface-variant)" }}
            >
              {specs.map((s, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span style={{ opacity: 0.3 }}>•</span>}
                  <span className="truncate">{s}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {l.deal && (
              <Badge
                tone={l.deal.tier === "great" ? "deal" : l.deal.tier === "high" ? "warn" : "neutral"}
                title="This car's price vs. similar listings in your results"
              >
                {dealText(l.deal)}
              </Badge>
            )}
            <Badge title="Match: how well it fits your search — price, distance, mileage & reliability">
              Match {l.value_score}
            </Badge>
            {l.reliability_flag && (
              <Badge tone={l.reliability_flag.severity === "avoid" ? "danger" : "warn"}>
                {l.reliability_flag.severity === "avoid" ? "⚠ Known issue" : "⚠ Heads up"}
              </Badge>
            )}
            {l.recall_count != null &&
              (l.recall_count === 0 ? (
                <Badge tone="good">✓ No open recalls</Badge>
              ) : (
                <Badge tone="warn">
                  ⚠ {l.recall_count} recall{l.recall_count === 1 ? "" : "s"}
                </Badge>
              ))}
            {l.complaints && l.complaints.total > 0 && (
              <Badge tone={l.complaints.powertrain >= 150 ? "warn" : "neutral"}>
                {l.complaints.total} complaints
              </Badge>
            )}
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--md-on-surface-variant)", opacity: 0.7 }}>
              {SOURCE_LABEL[l.source] ?? l.source}
            </span>
          </div>

          {l.reliability_flag && (
            <p
              className="mt-2 text-xs"
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
