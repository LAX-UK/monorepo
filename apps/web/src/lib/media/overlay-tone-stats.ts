declare const process: { env: { NODE_ENV?: string } };

type Stats = { samples: number; cacheHits: number; opaqueFallbacks: number };

function stats(): Stats | undefined {
  if (typeof window === "undefined") return undefined;
  if (process.env.NODE_ENV === "production") return undefined;
  if (!window.__overlayToneStats) {
    window.__overlayToneStats = { samples: 0, cacheHits: 0, opaqueFallbacks: 0 };
  }
  return window.__overlayToneStats;
}

export function recordSample(): void {
  const s = stats();
  if (s) s.samples += 1;
}

export function recordCacheHit(): void {
  const s = stats();
  if (s) s.cacheHits += 1;
}

export function recordOpaqueFallback(): void {
  const s = stats();
  if (s) s.opaqueFallbacks += 1;
}
