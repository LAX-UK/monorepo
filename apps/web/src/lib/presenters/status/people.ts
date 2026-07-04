import type { StatusBadgeVariant } from "./core";
import { badgeVariantFromRegistry } from "./core";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export const invitationStatusLabel: Record<InvitationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};

export const invitationStatusBadgeVariant: Partial<Record<InvitationStatus, StatusBadgeVariant>> = {
  accepted: "success",
  pending: "warning",
  expired: "neutral",
  revoked: "danger",
};

export function invitationStatusToBadgeVariant(
  status: InvitationStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(invitationStatusBadgeVariant, status);
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

export const inviteLifecycleBadgeVariant: Partial<
  Record<InviteLifecycleStatus, StatusBadgeVariant>
> = {
  accepted: "success",
  opened: "info",
  sent: "neutral",
  expired: "warning",
  bounced: "danger",
};

export function inviteLifecycleToBadgeVariant(
  status: InviteLifecycleStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(inviteLifecycleBadgeVariant, status);
}

export type UserAccountStatus = "active" | "suspended";

export const userAccountStatusLabel: Record<UserAccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
};

export const userAccountStatusBadgeVariant: Partial<Record<UserAccountStatus, StatusBadgeVariant>> =
  {
    active: "success",
    suspended: "danger",
  };

export function userAccountStatusToBadgeVariant(
  status: UserAccountStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(userAccountStatusBadgeVariant, status);
}

export type RegistrationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export const registrationStatusLabel: Record<RegistrationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const registrationStatusBadgeVariant: Partial<
  Record<RegistrationStatus, StatusBadgeVariant>
> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  withdrawn: "neutral",
};

export function registrationStatusToBadgeVariant(
  status: RegistrationStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(registrationStatusBadgeVariant, status);
}

export type KycStatus = "approved" | "pending" | "rejected" | null | undefined;

export const kycStatusLabelRegistry: Partial<Record<string, string>> = {
  approved: "Verified",
  pending: "Submitted",
  submitted: "Submitted",
  under_review: "In review",
  rejected: "Rejected",
  expired: "Expired",
};

export function kycStatusLabel(status: string | null | undefined): string {
  if (!status) return "Not verified";
  const mapped = kycStatusLabelRegistry[status];
  if (mapped) return mapped;
  return status.replaceAll("_", " ");
}

export const kycStatusBadgeVariant: Partial<Record<string, StatusBadgeVariant>> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
};

export function kycStatusToBadgeVariant(status: string | null | undefined): StatusBadgeVariant {
  if (!status) return "neutral";
  return badgeVariantFromRegistry(kycStatusBadgeVariant, status);
}
