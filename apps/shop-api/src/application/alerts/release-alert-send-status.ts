import type { AdminReleaseAlertSendStatus } from "@auction/shop-contracts";

/** A digest still unsent this long after it was made is stuck: the daily run should have sent it. */
export const RELEASE_ALERT_STUCK_AFTER_MS = 24 * 60 * 60 * 1000;

export type ReleaseAlertSendFacts = {
  /** False when the publisher chose not to tell subscribers. */
  announce: boolean;
  /** Whether the release has been turned into matches yet. */
  expanded: boolean;
  /** Matches not yet in a sent digest. */
  waiting: number;
  /** Whether any of its matches sits in a digest unsent for longer than the stuck threshold. */
  stuck: boolean;
};

/**
 * Where a release's alert stands (design LA-3, L2). A stuck digest outranks one still sending, so
 * staff see the one that needs them; a release with nothing waiting has finished.
 */
export function releaseAlertSendStatus(facts: ReleaseAlertSendFacts): AdminReleaseAlertSendStatus {
  if (!facts.announce) return "not_announced";
  if (!facts.expanded) return "queued";
  if (facts.stuck) return "not_sent_yet";
  if (facts.waiting > 0) return "sending";
  return "sent";
}
