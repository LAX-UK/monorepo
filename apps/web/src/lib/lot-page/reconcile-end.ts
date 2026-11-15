import { extensionAddedMs } from "@/lib/realtime/lot-extension";

type LotEndStatus = "active" | "scheduled" | "ended" | "cancelled" | "voided" | "draft";

export type EndReconciliation = {
  /** The close the page should now use. */
  endMs: number;
  /** A late bid moved the close: how much it added. Null when it did not move. */
  extension: { addedMs: number } | null;
};

/**
 * Whether a newly heard close is newer than the one the page has: `true` or `false` when both
 * carry the server's stamp (a lot read's `asOf`, an event's `changedAt`), so a read taken after
 * staff moved the close wins and one from before it loses. Without both stamps, an event is newer
 * (events for a lot arrive in order) and a read is unknown (`null`).
 */
export function heardIsNewer(
  knownAtMs: number | null,
  heardAtMs: number | null,
  source: "snapshot" | "event",
): boolean | null {
  if (knownAtMs !== null && heardAtMs !== null) return heardAtMs > knownAtMs;
  return source === "event" ? true : null;
}

/**
 * Decides what a newly heard close means. A close known to be newer is followed either way: later
 * is an extension, earlier is staff moving the close forward. One known to be older changes
 * nothing. Of unknown age (a read without a stamp), a live lot's close only moves later, so a read
 * in flight while an extension landed never moves it back. A lot that is not live follows.
 */
export function reconcileEnd(
  knownMs: number,
  heardMs: number,
  status: LotEndStatus,
  newer: boolean | null = null,
): EndReconciliation {
  if (!Number.isFinite(heardMs)) return { endMs: knownMs, extension: null };
  if (status !== "active") return { endMs: heardMs, extension: null };
  if (newer === false) return { endMs: knownMs, extension: null };
  if (heardMs > knownMs) {
    return {
      endMs: heardMs,
      extension: { addedMs: extensionAddedMs(knownMs, { endTimeMs: heardMs, serverNowMs: null }) },
    };
  }
  return { endMs: newer ? heardMs : knownMs, extension: null };
}

/**
 * Whether a lot read for the first time had already been extended by a late bid: its close is the
 * one the last extension set. Staff moving the close afterwards leaves `extendedUntil` behind, so a
 * close that is no longer the extended one reads as an ordinary lot.
 */
export function readsAsExtended(
  endMs: number,
  extendedUntil: string | null | undefined,
  status: LotEndStatus,
): boolean {
  if (status !== "active" || !extendedUntil) return false;
  const extendedMs = Date.parse(extendedUntil);
  return Number.isFinite(extendedMs) && endMs === extendedMs;
}
