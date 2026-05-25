"use client";

const STORAGE_KEY = "lax.recentlyViewedLots";
const MAX_ITEMS = 12;

export type RecentlyViewedLot = {
  id: string;
  href: string;
  title: string;
  viewedAt: number;
};

function readStorage(): RecentlyViewedLot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentlyViewedLot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items: RecentlyViewedLot[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore quota / jsdom gaps in tests
  }
}

/** Ring buffer of recently viewed lots (client-only). */
export function recordRecentlyViewedLot(entry: Omit<RecentlyViewedLot, "viewedAt">) {
  if (typeof window === "undefined") return;
  const next: RecentlyViewedLot = { ...entry, viewedAt: Date.now() };
  const items = readStorage().filter((item) => item.id !== entry.id);
  writeStorage([next, ...items]);
}

export function getRecentlyViewedLots(): RecentlyViewedLot[] {
  return readStorage();
}
