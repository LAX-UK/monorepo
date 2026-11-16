/** Human-readable labels for admin user detail fields. */

export { formatSignupPersona } from "./format-signup-persona";
import type { UserEmailStatus, UserKycStatus } from "@auction/types";

/** Every email address status as staff read it. A new status fails to compile until it is here. */
export const EMAIL_DELIVERABILITY_LABELS: Record<UserEmailStatus, string> = {
  ok: "Delivering normally",
  bounced: "Bounced",
  complained: "Marked as spam",
};

export function formatEmailDeliverabilityStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const known = EMAIL_DELIVERABILITY_LABELS[status as UserEmailStatus];
  if (known) return known;
  const words = status.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatUserRole(role: string): string {
  switch (role) {
    case "staff":
      return "Staff";
    case "client":
      return "Client";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

/**
 * The screening's check type as staff read it: the provider sends codes such as `initial_result`,
 * `updated_result` or `enhanced`, which never appear on screen as they are.
 */
export function amlCheckTypeLabel(checkType: string | null | undefined): string | null {
  if (!checkType) return null;
  switch (checkType) {
    case "initial":
    case "initial_result":
      return "Initial screening";
    case "ongoing":
    case "ongoing_monitoring":
    case "updated_result":
      return "Ongoing monitoring";
    case "enhanced":
      return "Enhanced check";
    default: {
      const words = checkType.replace(/[_-]+/g, " ").trim().toLowerCase();
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
  }
}

export function formatAmlCheckType(checkType: string | null | undefined): string {
  return amlCheckTypeLabel(checkType) ?? "—";
}

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

/** Lowercase phrase for inline sentences, e.g. "KYC rejected — follow up". */
export function kycStatusPhrase(status: string): string {
  const known = (KYC_STATUS_PHRASES as Record<string, string>)[status];
  return known ?? status.replaceAll("_", " ").toLowerCase();
}
