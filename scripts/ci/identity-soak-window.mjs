/** Shared 24h identity staging soak window constants and pure checks. */

export const SOAK_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SOAK_MAX_GAP_MS = 25 * 60 * 1000;
export const SOAK_TARGET_SAMPLES = 96;
/** Sleep before chaining the next sample (~13m + run time ≈ 15m cadence). */
export const SOAK_CHAIN_SLEEP_SEC = 780;

export function soakWindowEndMs(startedMs) {
  return startedMs + SOAK_WINDOW_MS;
}

export function isWithinSoakWindow(timestampMs, startedMs) {
  const endMs = soakWindowEndMs(startedMs);
  return timestampMs >= startedMs && timestampMs <= endMs;
}

export function filterWithinSoakWindow(items, getTimeMs, startedMs) {
  return items.filter((item) => isWithinSoakWindow(getTimeMs(item), startedMs));
}

export function isSoakWindowComplete(nowMs, startedMs) {
  return nowMs >= soakWindowEndMs(startedMs);
}

/**
 * @param {number[]} sortedTimesAsc
 * @param {number} maxGapMs
 * @returns {{ ok: true } | { ok: false; gapMs: number; betweenIndex: number }}
 */
export function checkSequentialGaps(sortedTimesAsc, maxGapMs) {
  for (let index = 1; index < sortedTimesAsc.length; index += 1) {
    const gapMs = sortedTimesAsc[index] - sortedTimesAsc[index - 1];
    if (gapMs > maxGapMs) {
      return { ok: false, gapMs, betweenIndex: index };
    }
  }
  return { ok: true };
}

/**
 * @param {number} firstSampleMs
 * @param {number} startedMs
 * @param {number} maxGapMs
 */
export function checkStartGap(firstSampleMs, startedMs, maxGapMs) {
  const gapMs = firstSampleMs - startedMs;
  if (gapMs > maxGapMs) {
    return { ok: false, gapMs };
  }
  return { ok: true };
}
