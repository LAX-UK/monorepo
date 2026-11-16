import type { UserEmailStatus, UserKycStatus } from "@auction/types";

/** Every email address status as staff read it. A new status fails to compile until it is here. */
export const EMAIL_DELIVERABILITY_LABELS: Record<UserEmailStatus, string> = {
  ok: "Delivering normally",
  bounced: "Bounced",
  complained: "Marked as spam",
};

/** Every identity status the staff screens show, as an inline phrase ("Identity check in review"). */
export const KYC_STATUS_PHRASES: Record<
  UserKycStatus | "submitted" | "under_review" | "expired",
  string
> = {
  unverified: "not started",
  pending: "submitted",
  submitted: "submitted",
  under_review: "in review",
  approved: "verified",
  rejected: "rejected",
  expired: "expired",
};
