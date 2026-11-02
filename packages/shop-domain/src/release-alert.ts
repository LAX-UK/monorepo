/**
 * Release alerts: a person asks to hear when LAX Shop publishes a new edition. A visitor confirms
 * their address by email before anything else is sent; a signed-in shopper's account address is
 * already verified. These rules say when a confirmation email goes out, when a confirmation link
 * still works, and which published artworks count as a release.
 */

/** What the person is told when they ask, and what is recorded as their consent. */
export const RELEASE_ALERT_CONSENT_TEXT =
  "One email for each new edition LAX Shop releases. Stop any time with the link in every email.";

/** How long the link in a confirmation email works. */
export const RELEASE_ALERT_CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

/** A second request for an address that is still waiting is ignored for this long. */
export const RELEASE_ALERT_RESEND_AFTER_MS = 10 * 60 * 1000;

export type ReleaseAlertStatus = "pending" | "confirmed" | "stopped";

export type ReleaseAlertSnapshot = {
  status: ReleaseAlertStatus;
  confirmRequestedAt: Date | null;
};

/**
 * Whether asking again should send a confirmation email. A confirmed address needs nothing, and
 * one that asked a moment ago already has an email on its way; a stopped address may start again.
 */
export function shouldSendReleaseAlertConfirmation(
  existing: ReleaseAlertSnapshot | null,
  now: Date,
): boolean {
  if (!existing || existing.status === "stopped") return true;
  if (existing.status === "confirmed") return false;
  const asked = existing.confirmRequestedAt?.getTime();
  return asked === undefined || now.getTime() - asked >= RELEASE_ALERT_RESEND_AFTER_MS;
}

export type ReleaseAlertConfirmation = "confirmed" | "already_confirmed" | "expired" | "invalid";

/** What following a confirmation link does, given the subscription its token belongs to. */
export function evaluateReleaseAlertConfirmation(
  row: ReleaseAlertSnapshot | null,
  now: Date,
): ReleaseAlertConfirmation {
  if (!row || row.status === "stopped") return "invalid";
  if (row.status === "confirmed") return "already_confirmed";
  const asked = row.confirmRequestedAt?.getTime();
  if (asked === undefined) return "invalid";
  return now.getTime() - asked > RELEASE_ALERT_CONFIRM_TTL_MS ? "expired" : "confirmed";
}

/**
 * Only an edition on sale in LAX Shop is a release. Originals and works on lax.art are sold
 * elsewhere, so a subscriber to Shop editions is not told about them.
 */
export function isShopEditionRelease(artwork: {
  salesChannel: string;
  eligibleForEditionAllocation: boolean;
}): boolean {
  return artwork.salesChannel === "shop" && artwork.eligibleForEditionAllocation;
}
