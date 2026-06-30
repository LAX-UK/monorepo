import type { StatusBadgeVariant } from "./core";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export const invitationStatusLabel: Record<InvitationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};

export function invitationStatusToBadgeVariant(
  status: InvitationStatus | string,
): StatusBadgeVariant {
  switch (status) {
    case "accepted":
      return "success";
    case "pending":
      return "warning";
    case "expired":
      return "neutral";
    case "revoked":
      return "danger";
    default:
      return "neutral";
  }
}

/** Admin invitations table — UX lifecycle distinct from DB enum. */
export type InviteLifecycleStatus = "sent" | "opened" | "accepted" | "expired" | "bounced";

export const inviteLifecycleLabel: Record<InviteLifecycleStatus, string> = {
  sent: "Sent",
  opened: "Opened",
  accepted: "Accepted",
  expired: "Expired",
  bounced: "Bounced",
};

export function inviteLifecycleToBadgeVariant(
  status: InviteLifecycleStatus | string,
): StatusBadgeVariant {
  switch (status) {
    case "accepted":
      return "success";
    case "opened":
      return "info";
    case "sent":
      return "neutral";
    case "expired":
      return "warning";
    case "bounced":
      return "danger";
    default:
      return "neutral";
  }
}

export type UserAccountStatus = "active" | "suspended";

export const userAccountStatusLabel: Record<UserAccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
};

export function userAccountStatusToBadgeVariant(
  status: UserAccountStatus | string,
): StatusBadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "danger";
    default:
      return "neutral";
  }
}

export type RegistrationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export const registrationStatusLabel: Record<RegistrationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function registrationStatusToBadgeVariant(
  status: RegistrationStatus | string,
): StatusBadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    case "withdrawn":
      return "neutral";
    default:
      return "neutral";
  }
}

export type KycStatus = "approved" | "pending" | "rejected" | null | undefined;

export function kycStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "approved":
      return "Verified";
    case "pending":
    case "submitted":
      return "Submitted";
    case "under_review":
      return "In review";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    default:
      return status ? status.replaceAll("_", " ") : "Not verified";
  }
}

export function kycStatusToBadgeVariant(status: string | null | undefined): StatusBadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}
