import type { ZohoMirrorNotApplicableReason, ZohoMirrorState } from "./admin-zoho-mirror.js";

/** The badge text for each state; `not_applicable` has no badge. */
export const ZOHO_MIRROR_BADGE_LABEL: Record<Exclude<ZohoMirrorState, "not_applicable">, string> = {
  mirrored: "Mirrored to Zoho",
  pending: "Sending to Zoho",
  failed: "Not in Zoho",
  dry_run: "Zoho dry run",
};

/** The details line for a record that is not mirrored. */
export const ZOHO_MIRROR_NOT_APPLICABLE_COPY: Record<ZohoMirrorNotApplicableReason, string> = {
  mirroring_off: "Not mirrored. Zoho mirroring is off.",
  not_paid: "Not mirrored. Only paid orders are sent to Zoho.",
  nothing_to_mirror: "Not mirrored. There is nothing to send to Zoho for this.",
  not_sent_yet: "Not mirrored. Nothing has been sent to Zoho for this yet.",
};
