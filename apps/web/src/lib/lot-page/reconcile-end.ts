import { extensionAddedMs } from "@/lib/realtime/lot-extension";

type LotEndStatus = "active" | "scheduled" | "ended" | "cancelled" | "voided" | "draft";

export type EndReconciliation = {
  /** The close the page should now use. */
  endMs: number;
  /** A late bid moved the close: how much it added. Null when it did not move. */
  extension: { addedMs: number } | null;
};

/**
 * Decides what a newly heard close means. A live lot's close only moves later, so an older close
 * (a snapshot that was in flight while an extension landed) never moves it back, and a later one
 * is an extension, whichever way it arrived (the event, a reconnect, or a fetch at "Closing…").
 * A lot that is not live follows what it is told.
 *
 * The close-time event is the exception to "only later": it is ordered, so an earlier close in it is
 * the staff moving the close forward, and the page follows it. A snapshot cannot say that, because
 * one in flight while a late bid landed is merely old.
 */
export function reconcileEnd(
  knownMs: number,
  heardMs: number,
  status: LotEndStatus,
  source: "snapshot" | "event" = "snapshot",
): EndReconciliation {
  if (!Number.isFinite(heardMs)) return { endMs: knownMs, extension: null };
  if (status !== "active") return { endMs: heardMs, extension: null };
  if (source === "event" && heardMs < knownMs) return { endMs: heardMs, extension: null };
  if (heardMs > knownMs) {
    return {
      endMs: heardMs,
      extension: { addedMs: extensionAddedMs(knownMs, { endTimeMs: heardMs, serverNowMs: null }) },
    };
  }
  return { endMs: knownMs, extension: null };
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
