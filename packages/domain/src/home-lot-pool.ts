/**
 * One lot pool for a page: each lot is used once, by slot priority. Earlier
 * slots claim their lots first (hero lead, then the sale rail, then "More lots").
 */

export type HomeLotSlot<T extends { id: string }> = {
  key: string;
  candidates: readonly T[];
  /** Most lots the slot takes. */
  limit: number;
  /** A slot that would hold fewer than this stays empty and claims nothing. */
  min?: number;
};

export function allocateHomeLots<T extends { id: string }>(
  slots: readonly HomeLotSlot<T>[],
): Record<string, T[]> {
  const used = new Set<string>();
  const result: Record<string, T[]> = {};
  for (const slot of slots) {
    const seen = new Set<string>();
    const fresh: T[] = [];
    for (const lot of slot.candidates) {
      if (used.has(lot.id) || seen.has(lot.id)) continue;
      seen.add(lot.id);
      fresh.push(lot);
    }
    const taken = fresh.length >= (slot.min ?? 1) ? fresh.slice(0, Math.max(0, slot.limit)) : [];
    for (const lot of taken) used.add(lot.id);
    result[slot.key] = taken;
  }
  return result;
}
