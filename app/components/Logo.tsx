"use client";

/**
 * dascar brand mark. The icon is a playful green badge with a speeding car; the wordmark is
 * "das" + a primary-tinted "car". Uses M3 tokens so it themes with the rest of the app.
 * (A standalone, hard-coded version lives in app/icon.svg for the favicon.)
 */

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="dascarGrad" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0" stopColor="var(--md-primary)" />
          <stop offset="1" stopColor="var(--md-tertiary)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#dascarGrad)" />
      {/* motion lines */}
      <rect x="6" y="27" width="9" height="3.5" rx="1.75" fill="white" opacity="0.75" />
      <rect x="6" y="34" width="6" height="3.5" rx="1.75" fill="white" opacity="0.5" />
      {/* car body + cabin */}
      <path d="M22 34 L27 27 Q28 25.5 30 25.5 L37 25.5 Q39 25.5 40 27.5 L43 34 Z" fill="white" />
      <rect x="14" y="33" width="37" height="10" rx="5" fill="white" />
      {/* window */}
      <path d="M29.5 33 L31.8 28.5 L36.2 28.5 L38 33 Z" fill="url(#dascarGrad)" />
      {/* wheels */}
      <circle cx="25" cy="44" r="5" fill="#0b3d22" />
      <circle cx="43" cy="44" r="5" fill="#0b3d22" />
      <circle cx="25" cy="44" r="1.9" fill="white" />
      <circle cx="43" cy="44" r="1.9" fill="white" />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-2xl font-black lowercase tracking-tight">
        das<span style={{ color: "var(--md-primary)" }}>car</span>
      </span>
    </span>
  );
}
