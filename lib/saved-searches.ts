import { getRedis } from "./limits";
import type { WizardProfile } from "./types";

/**
 * Durable saved searches for the alert engine (Wave 4). Requires Upstash; every function
 * degrades to a safe no-op / empty result when Redis isn't configured, so the app still runs.
 *
 *  - Each anon user's searches live under `dascar:saved:<anonId>` as a JSON array.
 *  - `dascar:saved:index` is a Set of anonIds so the cron can walk every saved search.
 */

export interface SavedSearch {
  id: string;
  profile: WizardProfile;
  email?: string;
  createdAt: number;
  lastVins: string[]; // VINs seen on the most recent run (for new-match diffing)
  lastPrices: Record<string, number>; // VIN -> last seen price (for price-drop diffing)
}

const userKey = (anonId: string) => `dascar:saved:${anonId}`;
const INDEX_KEY = "dascar:saved:index";
const MAX_PER_USER = 10;

export function savedSearchesEnabled(): boolean {
  return getRedis() !== null;
}

export async function listSavedSearches(anonId: string): Promise<SavedSearch[]> {
  const redis = getRedis();
  if (!redis) return [];
  return (await redis.get<SavedSearch[]>(userKey(anonId))) ?? [];
}

export async function addSavedSearch(
  anonId: string,
  profile: WizardProfile,
  email?: string,
): Promise<SavedSearch | null> {
  const redis = getRedis();
  if (!redis) return null;
  const existing = await listSavedSearches(anonId);
  const search: SavedSearch = {
    id: `ss_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    profile,
    email,
    createdAt: Date.now(),
    lastVins: [],
    lastPrices: {},
  };
  const next = [search, ...existing].slice(0, MAX_PER_USER);
  await redis.set(userKey(anonId), next);
  await redis.sadd(INDEX_KEY, anonId);
  return search;
}

export async function deleteSavedSearch(anonId: string, id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const next = (await listSavedSearches(anonId)).filter((s) => s.id !== id);
  if (next.length === 0) {
    await redis.del(userKey(anonId));
    await redis.srem(INDEX_KEY, anonId);
  } else {
    await redis.set(userKey(anonId), next);
  }
}

/** All anonIds that have at least one saved search (for the cron sweep). */
export async function allSavedUsers(): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  return (await redis.smembers(INDEX_KEY)) ?? [];
}

/** Persist the diff state after a cron run. */
export async function updateSavedState(
  anonId: string,
  id: string,
  lastVins: string[],
  lastPrices: Record<string, number>,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const all = await listSavedSearches(anonId);
  const next = all.map((s) => (s.id === id ? { ...s, lastVins, lastPrices } : s));
  await redis.set(userKey(anonId), next);
}
