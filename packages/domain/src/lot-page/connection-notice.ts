import type { LotStatusTone } from "./lifecycle-copy.js";

/** The live connection as the page sees it. */
export type LiveConnectionKind = "live" | "connecting" | "degraded" | "offline";

export type ConnectionNoticeKind = "reconnecting" | "slow" | "paused" | "restored";

export type ConnectionNoticeCopy = {
  tone: LotStatusTone;
  /** What the notice says on the page. */
  text: string;
  /** What a screen reader hears, once, when the notice appears. */
  announcement: string;
  /** The notice offers a refresh because updates may not come back by themselves. */
  offersRefresh: boolean;
};

/** One row per notice, so a new state is a new row rather than another branch. */
export const CONNECTION_NOTICES: Readonly<Record<ConnectionNoticeKind, ConnectionNoticeCopy>> = {
  reconnecting: {
    tone: "neutral",
    text: "Reconnecting to live bidding…",
    announcement: "Reconnecting to live bidding.",
    offersRefresh: false,
  },
  slow: {
    tone: "neutral",
    text: "Live updates are slow. You can still bid; we refresh the price before you confirm.",
    announcement: "Live updates are slow.",
    offersRefresh: false,
  },
  paused: {
    tone: "warning",
    text: "Live updates paused. The bid shown may be out of date.",
    announcement: "Live updates are paused. The bid shown may be out of date.",
    offersRefresh: true,
  },
  restored: {
    tone: "success",
    text: "Live bidding restored. Bid up to date.",
    announcement: "Live bidding restored.",
    offersRefresh: false,
  },
};

/** A short loss is not worth a notice: nothing shows until the connection has been gone this long. */
export const CONNECTION_NOTICE_AFTER_MS = 3_000;
/** After this long without updates the notice says the price may be out of date. */
export const CONNECTION_PAUSED_AFTER_MS = 30_000;
/** How long "restored" stays before the notice leaves. */
export const CONNECTION_RESTORED_FOR_MS = 3_000;

export type ConnectionNoticeInput = {
  state: LiveConnectionKind;
  /** How long the connection has been lost or degraded; 0 while it is live. */
  troubledForMs: number;
  /** Whether a loss notice was shown before the connection came back. */
  noticeWasShown: boolean;
  /** How long it has been live again since a shown notice; `null` if it never recovered. */
  restoredForMs: number | null;
};

/**
 * The notice to show, or `null` when nothing should: a healthy connection says nothing. Pure, so
 * the timing rules are testable without a clock.
 */
export function connectionNoticeFor(input: ConnectionNoticeInput): ConnectionNoticeKind | null {
  if (input.state === "live") {
    const recent =
      input.noticeWasShown &&
      input.restoredForMs !== null &&
      input.restoredForMs < CONNECTION_RESTORED_FOR_MS;
    return recent ? "restored" : null;
  }
  if (input.troubledForMs < CONNECTION_NOTICE_AFTER_MS) return null;
  if (input.troubledForMs >= CONNECTION_PAUSED_AFTER_MS && input.state !== "degraded") {
    return "paused";
  }
  return input.state === "degraded" ? "slow" : "reconnecting";
}
