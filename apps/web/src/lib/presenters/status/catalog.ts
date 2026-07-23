import type { ArtistStatus, ItemSubmissionStatus, LotStatus, SaleStatus } from "@auction/types";
import type { StatusBadgeVariant } from "./core";
import { badgeVariantFromRegistry } from "./core";

export const lotStatusLabel: Record<LotStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
  voided: "Voided",
};

export const saleStatusLabel: Record<SaleStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
};

export const artistStatusLabel: Record<ArtistStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  merged_into: "Merged",
};

export const submissionStatusLabel: Record<ItemSubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  converted: "Converted",
};

export const lotStatusBadgeVariant: Partial<Record<LotStatus, StatusBadgeVariant>> = {
  active: "live",
  scheduled: "info",
  draft: "info",
  ended: "neutral",
  cancelled: "danger",
  voided: "danger",
};

/** Maps catalog lot lifecycle to `StatusBadge` variants (OCP: extend map, not callers). */
export function lotStatusToBadgeVariant(status: LotStatus | string): StatusBadgeVariant {
  return badgeVariantFromRegistry(lotStatusBadgeVariant, status);
}

export const saleStatusBadgeVariant: Partial<Record<SaleStatus, StatusBadgeVariant>> = {
  active: "live",
  scheduled: "info",
  draft: "info",
  ended: "neutral",
  cancelled: "danger",
};

export function saleStatusToBadgeVariant(status: SaleStatus): StatusBadgeVariant {
  return badgeVariantFromRegistry(saleStatusBadgeVariant, status);
}

export const artistStatusBadgeVariant: Partial<Record<ArtistStatus, StatusBadgeVariant>> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  merged_into: "neutral",
};

export function artistStatusToBadgeVariant(status: ArtistStatus): StatusBadgeVariant {
  return badgeVariantFromRegistry(artistStatusBadgeVariant, status);
}

export const submissionStatusBadgeVariant: Partial<
  Record<ItemSubmissionStatus, StatusBadgeVariant>
> = {
  approved: "success",
  converted: "success",
  submitted: "info",
  under_review: "warning",
  rejected: "danger",
};

export function submissionStatusToBadgeVariant(status: ItemSubmissionStatus): StatusBadgeVariant {
  return badgeVariantFromRegistry(submissionStatusBadgeVariant, status);
}

export type CategoryLifecycleStatus = "active" | "archived";

export const categoryLifecycleLabel: Record<CategoryLifecycleStatus, string> = {
  active: "Active",
  archived: "Archived",
};

export const categoryLifecycleBadgeVariant: Partial<
  Record<CategoryLifecycleStatus, StatusBadgeVariant>
> = {
  archived: "danger",
  active: "success",
};

export function categoryLifecycleToBadgeVariant(
  status: CategoryLifecycleStatus,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(categoryLifecycleBadgeVariant, status);
}
