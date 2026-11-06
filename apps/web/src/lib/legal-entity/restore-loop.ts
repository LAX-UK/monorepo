/**
 * A restore sets the account cookie and sends the browser back to the page it wanted. If the
 * layout asks for another restore straight away, the cookie did not stick; repeating the hop
 * would loop for ever. A short-lived marker, left by the restore hop, tells the layout to stop
 * and show the retry state instead.
 */
export const RESTORE_MARKER_COOKIE = "lax_account_restored";

/** Long enough to cover the hop and the page after it; short enough that a later visit tries again. */
export const RESTORE_MARKER_MAX_AGE_SEC = 30;

export type RestoreStep =
  /** The browser has a usable account. */
  | "none"
  /** Open the page through the restore hop (a full page load). */
  | "hop"
  /** A restore just ran and did not take: show the retry state and report it. */
  | "stalled";

export function nextRestoreStep(input: {
  needsRestore: boolean;
  markerPresent: boolean;
}): RestoreStep {
  if (!input.needsRestore) return "none";
  return input.markerPresent ? "stalled" : "hop";
}
