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

export function ListingCard({ listing: l }: { listing: NormalizedListing }) {
  return (
    <a
      href={l.listing_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-blue-400 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
        {l.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image_url} alt={l.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🚘</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-medium">{l.title || "Vehicle"}</h3>
          <span className="shrink-0 text-sm font-semibold text-blue-600 dark:text-blue-400">
            {money(l.price)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
          {l.mileage != null && <span>{miles(l.mileage)}</span>}
          {l.drivetrain && <span>{l.drivetrain}</span>}
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
        </div>

        {l.reliability_flag && (
          <p
            className={`mt-1.5 text-xs ${
              l.reliability_flag.severity === "avoid"
                ? "text-red-600 dark:text-red-400"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            {l.reliability_flag.issue}
          </p>
        )}
      </div>
    </a>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "value" | "good" | "warn" | "danger";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    value: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    good: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
