"use client";

import { useSyncExternalStore } from "react";
import type { NormalizedListing } from "./types";

/**
 * Tiny localStorage-backed stores for the stickiness layer (Wave 4) that work with zero backend:
 *  - favorites: cars the user hearted (full objects, so a "Saved" view survives a new search)
 *  - recently viewed: the last few cars whose detail modal was opened
 *  - anonId: a stable anonymous id used to key server-side saved searches
 * Each store exposes a React hook via useSyncExternalStore so every card re-renders in sync the
 * instant a heart is toggled, with no prop-drilling or context.
 */

const FAV_KEY = "dascar:favorites";
const RECENT_KEY = "dascar:recently-viewed";
const ANON_KEY = "dascar:anon-id";
const RECENT_MAX = 12;

const isBrowser = typeof window !== "undefined";

function listingId(l: NormalizedListing): string {
  return l.vin ? `vin:${l.vin.toUpperCase()}` : `url:${l.listing_url}`;
}

// ---- generic localStorage-backed list store -----------------------------------------------

function createListStore(key: string, max: number) {
  let cache: NormalizedListing[] | null = null;
  const listeners = new Set<() => void>();

  function read(): NormalizedListing[] {
    if (cache) return cache;
    if (!isBrowser) return (cache = []);
    try {
      cache = JSON.parse(localStorage.getItem(key) || "[]") as NormalizedListing[];
    } catch {
      cache = [];
    }
    return cache!;
  }

  function write(next: NormalizedListing[]): void {
    cache = next.slice(0, max);
    if (isBrowser) {
      try {
        localStorage.setItem(key, JSON.stringify(cache));
      } catch {
        /* quota or privacy mode — keep working in-memory only */
      }
    }
    listeners.forEach((l) => l());
  }

  return {
    getSnapshot: read,
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    toggle(item: NormalizedListing) {
      const id = listingId(item);
      const list = read();
      write(list.some((x) => listingId(x) === id) ? list.filter((x) => listingId(x) !== id) : [item, ...list]);
    },
    push(item: NormalizedListing) {
      const id = listingId(item);
      const list = read().filter((x) => listingId(x) !== id);
      write([item, ...list]);
    },
    remove(item: NormalizedListing) {
      const id = listingId(item);
      write(read().filter((x) => listingId(x) !== id));
    },
  };
}

const favStore = createListStore(FAV_KEY, 200);
const recentStore = createListStore(RECENT_KEY, RECENT_MAX);

const EMPTY: NormalizedListing[] = [];

export function useFavorites() {
  const favorites = useSyncExternalStore(favStore.subscribe, favStore.getSnapshot, () => EMPTY);
  const ids = new Set(favorites.map(listingId));
  return {
    favorites,
    isFavorite: (l: NormalizedListing) => ids.has(listingId(l)),
    toggleFavorite: (l: NormalizedListing) => favStore.toggle(l),
  };
}

export function useRecentlyViewed() {
  return useSyncExternalStore(recentStore.subscribe, recentStore.getSnapshot, () => EMPTY);
}

/** Record a car as viewed (called when its detail modal opens). */
export function recordView(l: NormalizedListing): void {
  recentStore.push(l);
}

/** Stable per-browser anonymous id (for keying server-side saved searches). */
export function getAnonId(): string {
  if (!isBrowser) return "anonymous";
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    try {
      localStorage.setItem(ANON_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}
