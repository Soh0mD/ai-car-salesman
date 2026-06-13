import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * Cost-cap layer for the "capped public demo" model. When Upstash env vars are present we
 * enforce a per-IP rate limit and cache responses keyed on the distilled constraints (so
 * repeat/identical searches never re-bill the Claude API). When absent (local dev), both
 * degrade to no-ops so the app still runs.
 *
 * Pair this with a hard monthly spend limit on your Anthropic key — that is the real
 * backstop against a surprise bill.
 */

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash ? Redis.fromEnv() : null;

const ratelimiter = redis
  ? new Ratelimit({
      redis,
      // 10 searches per IP per minute — generous for a human, brutal for a spam bot.
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "acs:rl",
    })
  : null;

/** Best-effort client IP from proxy headers (for per-IP rate limiting). */
export function clientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous";
}

/** Returns true if the request is allowed. No-op (always allowed) without Upstash. */
export async function checkRateLimit(ip: string): Promise<boolean> {
  if (!ratelimiter) return true;
  const { success } = await ratelimiter.limit(ip);
  return success;
}

const CACHE_TTL_SECONDS = 60 * 30; // 30 min — inventory shifts slowly enough
const localCache = new Map<string, { value: unknown; expiresAt: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  const hit = localCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value as T;
  localCache.delete(key);
  return null;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  if (redis) {
    await redis.set(key, value, { ex: CACHE_TTL_SECONDS });
    return;
  }
  localCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 });
}

/** Stable cache key from the parts of a search that actually affect results. */
export function planCacheKey(parts: Record<string, unknown>): string {
  return "acs:plan:" + JSON.stringify(parts);
}
