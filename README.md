# 🚗 AI Car Salesman

A conversational used-car finder. Describe what you need in plain English
("3 kids, hate minivans, live in Indy, good mileage, under $25k") and it:

1. uses **Claude** (`claude-sonnet-4-6`) to turn that into a precise search plan +
   honest buying advice (including which failure-prone powertrains to avoid),
2. fans out **concurrently** to live inventory sources,
3. enriches the top results with **NHTSA recall data**, and
4. returns ranked, clickable listings — best value first.

The edge over a plain meta-search (AutoTempest, etc.) is the conversational +
reliability-advice layer, not raw data breadth.

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind v4**
- **Anthropic SDK** — structured extraction via tool-use
- Inventory: **Marketcheck** (dealers), **eBay Browse** (private/enthusiast),
  **Auto.dev** (backup); **NHTSA** for recalls + VIN decode (free, keyless)
- **Upstash Redis** (optional) for per-IP rate-limit + response cache

```
app/page.tsx            chat UI (SSE client)
app/api/chat/route.ts   SSE endpoint: brain -> aggregate -> stream
lib/llm.ts              Claude tool-use extraction -> SearchPlan
lib/aggregate.ts        concurrent fan-out, dedupe, NHTSA enrich, score, sort
lib/sources/*.ts        marketcheck / ebay / autodev clients
lib/nhtsa.ts            recall counts + VIN decode
lib/reliability.ts      curated known-issue rules (deterministic backstop to the LLM)
lib/limits.ts           rate-limit + cache (no-op without Upstash)
```

## Setup
1. **Install deps:** `npm install`
2. **Add keys:** copy `.env.local.example` → `.env.local` and fill in what you have.
   - **Required:** `ANTHROPIC_API_KEY` (console.anthropic.com). **Set a monthly spend
     limit** there (e.g. $10) — that cap is what makes a public demo safe.
   - **Optional** (each missing key just skips that source): `MARKETCHECK_API_KEY`,
     `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET`, `AUTODEV_API_KEY`.
   - **Optional cost-cap:** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
3. **Run:** `npm run dev` → http://localhost:3000

## Verify
- **Reliability layer (no keys needed):** `npm run test:sources` — hits live NHTSA for
  recall counts + a VIN decode and runs the full aggregate pipeline.
- **Full loop:** add `ANTHROPIC_API_KEY` (+ at least one inventory key), `npm run dev`,
  and try an example prompt. You should see advice stream in, then ranked listing cards.

## Deploy (capped public demo)
1. Push to GitHub.
2. Import the repo at vercel.com (free). Framework auto-detects as Next.js.
3. Add the same env vars in **Vercel → Project → Settings → Environment Variables**.
4. Deploy. Confirm the Anthropic spend limit is set, and (recommended) add Upstash so the
   per-IP rate limit is live. Worst-case abuse then = a `429`, never a surprise bill.

## Notes
- Inventory mappers (`lib/sources/*.ts`) degrade gracefully if an API renames a field;
  sanity-check the mapping once with `npm run test:sources` after adding each key.
- Facebook Marketplace was deliberately excluded (no API, violates Meta ToS, scrapers
  break constantly). Add it later via an Apify actor + webhook if you really want it.
