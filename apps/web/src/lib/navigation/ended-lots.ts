import { useSyncExternalStore } from "react";
import type { ClientAttention } from "./client-attention";

/**
 * Lots this browser has just seen close (`lot.closed` / `lotEnded`). The account facts behind the
 * attention chip are re-read at most every 30 seconds, so a lot that closes while it is open would
 * keep showing "Outbid on ..." until then. These ids drop it at once.
 */
let endedLotIds: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function markLotEnded(lotId: string): void {
  if (!lotId || endedLotIds.has(lotId)) return;
  endedLotIds = new Set([...endedLotIds, lotId]);
  for (const listener of listeners) listener();
}

/** Test seam: forget every ended lot. */
export function resetEndedLots(): void {
  endedLotIds = new Set();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEndedLotIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => endedLotIds,
    () => endedLotIds,
  );
}

/** The attention without outbid prompts for lots that have since closed. */
export function withoutEndedLots(
  attention: ClientAttention,
  ended: ReadonlySet<string>,
): ClientAttention {
  if (ended.size === 0) return attention;
  const outbid = attention.groups.find((group) => group.kind === "outbid");
  const closed = outbid?.items.filter((item) => ended.has(item.lotId)) ?? [];
  if (!outbid || closed.length === 0) return attention;
  const items = outbid.items.filter((item) => !ended.has(item.lotId));
  const groups = attention.groups.flatMap((group) => {
    if (group !== outbid) return [group];
    return items.length > 0 ? [{ ...group, items, count: items.length }] : [];
  });
  // `outbidLots` is the same lots by number, soonest first; the closed ones are no longer waiting.
  const remaining = Math.max(0, attention.outbidLots.length - closed.length);
  return { ...attention, groups, outbidLots: attention.outbidLots.slice(0, remaining) };
}
