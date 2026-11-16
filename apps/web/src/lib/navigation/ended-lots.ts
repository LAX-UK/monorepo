import { LOT_ENDED_SIGNAL } from "@/lib/realtime/lot-ended-signal";
import { useMemo, useSyncExternalStore } from "react";
import { type AttentionChip, type ClientAttention, attentionChip } from "./client-attention";

/**
 * Lots this browser has just seen close. The account facts behind the outbid prompt are re-read at
 * most every 30 seconds, so a lot that closes while its page is open would keep showing "Outbid on
 * ..." until then. These ids drop it at once.
 *
 * Only the lazily loaded header parts (the attention chip and the signed-in account entry) import
 * this module, so the shared frame every page loads does not grow. The lot page tells it about a
 * close with a window event (`LOT_ENDED_SIGNAL`), not by importing it.
 *
 * The set only grows during a visit: if staff reopen a lot after it closed (a voided hammer, say),
 * its outbid prompt stays hidden until the next full load. That is rare, and the My bids page
 * still shows the lot.
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

if (typeof window !== "undefined") {
  window.addEventListener(LOT_ENDED_SIGNAL, (event) => {
    const lotId = (event as CustomEvent<unknown>).detail;
    if (typeof lotId === "string") markLotEnded(lotId);
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => endedLotIds;

export function useEndedLotIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The attention without the outbid prompts for lots that have closed since it was read. */
export function withoutEndedLots(
  attention: ClientAttention,
  ended: ReadonlySet<string>,
): ClientAttention {
  if (ended.size === 0) return attention;
  const outbid = attention.groups.find((group) => group.kind === "outbid");
  const ids = attention.outbidLotIds;
  const closedInGroup = outbid?.items.some((item) => ended.has(item.lotId)) ?? false;
  const closedInList = ids?.some((id) => id !== null && ended.has(id)) ?? false;
  if (!closedInGroup && !closedInList) return attention;

  const groups = attention.groups.flatMap((group) => {
    if (group !== outbid) return [group];
    const items = group.items.filter((item) => !ended.has(item.lotId));
    return items.length > 0 ? [{ ...group, items, count: items.length }] : [];
  });
  if (!ids) {
    // Facts read without lot ids (an older payload): only the count can be kept right.
    const closed =
      (outbid?.items.length ?? 0) - (groups.find((g) => g.kind === "outbid")?.count ?? 0);
    const remaining = Math.max(0, attention.outbidLots.length - closed);
    return { ...attention, groups, outbidLots: attention.outbidLots.slice(0, remaining) };
  }
  // `outbidLots` and `outbidLotIds` name the same lots in the same order, so the closed ones are
  // dropped by id and the remaining labels stay with their lots.
  const keep = (_: unknown, index: number) => {
    const id = ids[index];
    return id == null || !ended.has(id);
  };
  return {
    ...attention,
    groups,
    outbidLots: attention.outbidLots.filter(keep),
    outbidLotIds: ids.filter(keep),
  };
}

/** `attention` with the lots that closed during this visit taken out of its outbid prompts. */
export function useAttentionWithoutEndedLots(
  attention: ClientAttention | null,
): ClientAttention | null {
  const ended = useEndedLotIds();
  return useMemo(() => (attention ? withoutEndedLots(attention, ended) : null), [attention, ended]);
}

/**
 * The header's urgent prompt with the lots that closed during this visit taken out. Until a lot
 * closes it is the prompt the frame already worked out.
 */
export function useChipWithoutEndedLots(loaded: {
  attention: ClientAttention | null;
  chip: AttentionChip | null;
}): { attention: ClientAttention | null; chip: AttentionChip | null } {
  const attention = useAttentionWithoutEndedLots(loaded.attention);
  return useMemo(
    () =>
      attention === loaded.attention
        ? { attention, chip: loaded.chip }
        : { attention, chip: attention ? attentionChip(attention) : null },
    [attention, loaded.attention, loaded.chip],
  );
}
