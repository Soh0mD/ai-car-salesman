# 🚗 dascar

**Live:** [dascar.xyz](https://dascar.xyz)

A guided used-car finder that does the tab-juggling for you. Answer a few quick
questions (or just describe what you want in plain English) and dascar:

1. uses **Claude Haiku 4.5** to turn your needs into a precise search plan **and**
   stream warm, master-mechanic buying advice — in a single call,
2. fans out **concurrently** to live inventory sources,
3. enriches each result with **reliability + running-cost + safety** data
   (NHTSA recalls & complaints, EPA fuel economy, NHTSA safety ratings, plus a
   curated known-issue layer), and
4. returns ranked, clickable listings — best value first — each with a price-vs-market
   **deal** badge and a **Match** score.

The edge over a plain meta-search (AutoTempest, etc.) is the conversational +
reliability + buyer-tools layer, not raw data breadth.

## What's inside

**Find & rank**
- Guided 11-step **wizard** (budget, location, seats, year, mileage, use, priorities,
  drivetrain, transmission, body styles, enthusiast extras) with a per-step "pro tip".
- Free-text **chat** mode ("reliable AWD SUV for snowy commutes near Indy, under $22k").
- Deterministic: temperature-0 extraction + a 30-minute profile-keyed cache, so identical
  answers give identical results.

**Trust signals on every car**
- Live **NHTSA recalls** + consumer-complaint volume, and a curated known-issue rule set.
- **EPA fuel economy** + estimated annual fuel cost + EV range (FuelEconomy.gov).
- **NHTSA 5-star safety** ratings (fetched on demand in the detail view).
- **VIN check** — decodes the VIN (NHTSA VPIC) to confirm it's real and matches the listing's
  year/make/model (a mismatch is flagged as a fraud risk), plus a one-click deep-link to the
  free government **title-history** record (salvage/flood/owners) at vehiclehistory.gov.
- **Certified Pre-Owned** detection — CPO listings are badged and called out (warranty signal).
- **Dealer reputation** — Google rating + review count next to the dealer (needs a Google
  Places key; hidden when not configured).
- A **deal** badge (price vs. comparable in-set listings) distinct from the **Match** score
  (how well a car fits your search).

**Buyer intelligence (in the detail modal)**
- **5-year cost to own** — fuel + maintenance + insurance + depreciation, with a resale-value
  outlook and a hold-value indicator (Toyota vs. BMW becomes obvious).
- **Finance _and_ lease** payment calculators (toggle between them).
- **EV commute calculator** — enter your commute, see whether a charge covers it and the
  monthly charging cost vs. an equivalent gas car (EV/PHEV listings only).
- **AI buying tips** — fair-offer range, model-specific inspection checklist, seller questions,
  plus a **ready-to-send negotiation message** you can copy and paste to the dealer.
- **AI photo damage scan** — Claude vision checks a listing photo for visible damage/rust/
  mismatched panels (user-triggered; rate-limited + cached).
- Buying advice is **season-aware** (e.g. Q4 dealer-clearance leverage) via the current month.

**Results UX**
- Sort + filter, a **scarcity** hint when matches are rare, a **compare drawer** (up to 4 cars
  side-by-side), conversational **refine** chips ("cheaper", "newer", "lower miles", "only AWD"),
  and an in-site **detail modal** — so the experience is the same no matter which site a car is from.

**Stickiness**
- **Favorites** + **recently-viewed** (localStorage, no backend).
- **Saved searches + email alerts** for new matches & price drops (needs Upstash + Resend +
  a Vercel cron; degrades gracefully to "coming soon" when not configured).

**Design** — "Teal & Timber / Joyride": a brighter teal palette with a warm sienna accent,
Montserrat headlines + Quicksand body, Tabler line icons, and automatic **light/dark** via the
browser's `prefers-color-scheme`.

## Stack
- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** + **Tailwind v4**
- **Anthropic SDK** — Claude Haiku 4.5, structured extraction via tool-use + streaming
- Inventory: **Marketcheck** (dealers), **Auto.dev** (backup), **eBay Browse** (pending
  production keys); **NHTSA** (recalls/complaints/safety) + **FuelEconomy.gov** (MPG) are
  free & keyless
- **Upstash Redis** (optional) — response cache, per-IP rate limit, saved-search storage
- **Resend** (optional) — saved-search alert emails
- **Google Places API** (optional) — dealer reputation stars + review counts
- `framer-motion`, `@tabler/icons-react`

```
app/page.tsx              stage machine: landing / wizard / results / chat (framer-motion)
app/layout.tsx            fonts (Montserrat + Quicksand) + SEO/OG metadata
app/globals.css           design tokens (light + dark), component classes
app/opengraph-image.tsx   generated social share card (next/og)
app/robots.ts, sitemap.ts SEO
app/components/            Landing, Wizard, Results, ResultsList, ListingCard, DetailModal,
                          CompareDrawer, SaveSearchButton, Dropdown, Chat, Logo
app/api/find              wizard search (structured profile -> deterministic overrides)
app/api/chat              free-text chat search
app/api/car-intel         on-demand fuel economy + safety for one car
app/api/advise            AI buying tips for one car (offer range, inspect list, negotiation msg)
app/api/vin-check         VIN decode + listing-spec match (NHTSA VPIC)
app/api/dealer-info       dealer Google rating (no-op without GOOGLE_PLACES_API_KEY)
app/api/photo-check       AI vision damage scan of one listing photo (Haiku)
app/api/saved-searches    save/list/delete saved searches (Upstash)
app/api/alerts/cron       daily alert sweep -> emails new matches / price drops (vercel.json)
lib/pipeline.ts           shared: single reply+plan stream, overrides, progressive listings
lib/llm.ts                streamReplyAndPlan + getBuyingTips (w/ negotiation) + scanPhotoForDamage
lib/aggregate.ts          searchAndRank (fast) + enrichListings (NHTSA) — dedupe, score, sort, deals
lib/sources/*.ts          marketcheck / autodev / ebay clients (+ CPO + dealer location)
lib/nhtsa.ts              recall counts + complaint stats + VIN decode + safety ratings
lib/vin.ts                VIN verification (VPIC decode + listing-spec mismatch detection)
lib/ownership-cost.ts     5-year cost of ownership + depreciation/resale estimates
lib/dealer.ts             dealer reputation via Google Places (optional)
lib/fueleconomy.ts        EPA MPG / annual fuel cost / EV range
lib/reliability.ts        curated known-issue rules (deterministic backstop to the LLM)
lib/client-store.ts       favorites + recently-viewed + anon id (localStorage)
lib/saved-searches.ts     saved-search storage (Upstash); lib/email.ts  Resend sender
lib/limits.ts             rate-limit + cache (no-op without Upstash)
lib/search-client.ts      client-side SSE consumption
```

## Setup
1. **Install deps:** `npm install`
2. **Add keys:** copy `.env.example` → `.env.local` and fill in what you have.
   - **Required:** `ANTHROPIC_API_KEY` (console.anthropic.com). **Set a monthly spend limit**
     there — that cap is what makes a public demo safe.
   - **Recommended** (each missing key just skips that source): `MARKETCHECK_API_KEY`,
     `AUTODEV_API_KEY`. **Optional:** `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` (production
     Buy/Browse access).
   - **Optional infra:** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (cache,
     rate-limit, saved searches); `RESEND_API_KEY` + `ALERT_FROM_EMAIL` and `CRON_SECRET`
     (saved-search alert emails); `GOOGLE_PLACES_API_KEY` (dealer reputation ratings).
3. **Run:** `npm run dev` → http://localhost:3000

## Verify
- **Reliability layer (no keys needed):** `npm run test:sources` — hits live NHTSA for recall
  counts + a VIN decode and runs the full aggregate pipeline.
- **Full loop:** add `ANTHROPIC_API_KEY` (+ at least one inventory key), `npm run dev`, and try
  the wizard or a chat prompt. You should see advice stream in, then ranked listing cards.

## Deploy (capped public demo)
1. Push to GitHub.
2. Import the repo at vercel.com (free). Framework auto-detects as Next.js.
3. Add the same env vars in **Vercel → Project → Settings → Environment Variables**.
4. Deploy. Confirm the Anthropic spend limit is set, and (recommended) add Upstash so the
   per-IP rate limit + caching are live. Worst-case abuse then = a `429`, never a surprise bill.
5. Saved-search alerts also need Resend (`RESEND_API_KEY`, `ALERT_FROM_EMAIL`) + `CRON_SECRET`;
   the daily cron is defined in `vercel.json`.

## Notes
- Inventory mappers (`lib/sources/*.ts`) degrade gracefully if an API renames a field;
  sanity-check the mapping once with `npm run test:sources` after adding each key.
- Listing images use plain `<img loading="lazy">` (dealer image domains are unbounded, so
  `next/image` would add proxy cost for no real gain).
- Facebook Marketplace was deliberately excluded (no API, violates Meta ToS, scrapers break
  constantly).
