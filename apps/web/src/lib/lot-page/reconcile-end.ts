import { extensionAddedMs } from "@/lib/realtime/lot-extension";

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
 */
export function reconcileEnd(
  knownMs: number,
  heardMs: number,
  status: "active" | "scheduled" | "ended" | "cancelled" | "voided" | "draft",
): EndReconciliation {
  if (!Number.isFinite(heardMs)) return { endMs: knownMs, extension: null };
  if (status !== "active") return { endMs: heardMs, extension: null };
  if (heardMs > knownMs) {
    return {
      endMs: heardMs,
      extension: { addedMs: extensionAddedMs(knownMs, { endTimeMs: heardMs, serverNowMs: null }) },
    };
  }
  return { endMs: knownMs, extension: null };
}
