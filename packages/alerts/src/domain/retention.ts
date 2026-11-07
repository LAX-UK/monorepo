import { CONFIRM_LINK_TTL_MS } from "./subscriber.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long alert data is kept, in one place. Bid and Shop prune their own tables with these cutoffs;
 * neither decides a period itself. Every rule is conservative on purpose: when in doubt, keep.
 *
 * Never pruned, whatever the age:
 * - an active (confirmed) subscription and its topic switches;
 * - the address-level email suppression list (`email_suppression`), which is not touched here;
 * - a subscriber stopped by a complaint: the row stays (detached from any account) so the address is
 *   not mailed again, the same rule erasure follows.
 */
export const ALERT_RETENTION = {
  /**
   * Rule 1. A double opt-in that was never confirmed. A confirm link dies after 48 hours
   * (`CONFIRM_LINK_TTL_MS`), so nothing can confirm it afterwards; the row waits 30 days from the
   * request, well past that expiry, then goes. A re-request moves `requestedAt`, so a person still
   * trying is never cut off.
   */
  unconfirmedDays: 30,
  /**
   * Rule 2. A subscriber who stopped (link, one-click, settings, staff or erasure) is kept for two
   * years (730 days) after the stop: the consent evidence (when and how they agreed, and when and
   * why they stopped) answers a later complaint. Then the row and everything under it goes. A
   * complaint-stopped row keeps only the row itself (address, status, stop reason, consent proof);
   * its topics, matches and digests go after the same two years.
   */
  stoppedDays: 730,
  /**
   * Rule 3. Match and digest logs go after 90 days. Only settled matches (in a digest or dropped)
   * and sent digests are removed, so nothing still waiting to be sent is ever lost.
   */
  logDays: 90,
} as const;

/** The instants before which each kind of alert data is due for removal. */
export type AlertRetentionCutoffs = {
  /** A pending subscriber requested before this is due. */
  unconfirmedBefore: Date;
  /** A stopped subscriber stopped before this is due. */
  stoppedBefore: Date;
  /** Settled matches and sent digests created before this are due. */
  logsBefore: Date;
};

export function alertRetentionCutoffs(now: Date): AlertRetentionCutoffs {
  // Never shorter than the confirm link: a link that still works must find its row.
  const unconfirmedMs = Math.max(ALERT_RETENTION.unconfirmedDays * DAY_MS, CONFIRM_LINK_TTL_MS);
  return {
    unconfirmedBefore: new Date(now.getTime() - unconfirmedMs),
    stoppedBefore: new Date(now.getTime() - ALERT_RETENTION.stoppedDays * DAY_MS),
    logsBefore: new Date(now.getTime() - ALERT_RETENTION.logDays * DAY_MS),
  };
}
