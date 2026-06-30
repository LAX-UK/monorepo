import type { ArtistStatus, ItemSubmissionStatus, LotStatus, SaleStatus } from "@auction/types";
import type { StatusBadgeVariant } from "./core";

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

/** Maps catalog lot lifecycle to `StatusBadge` variants (OCP: extend map, not callers). */
export function lotStatusToBadgeVariant(status: LotStatus | string): StatusBadgeVariant {
  switch (status) {
    case "active":
      return "live";
    case "scheduled":
      return "info";
    case "draft":
      return "neutral";
    case "ended":
      return "success";
    case "cancelled":
    case "voided":
      return "danger";
    default:
      return "neutral";
  }
}

export function saleStatusToBadgeVariant(status: SaleStatus): StatusBadgeVariant {
  switch (status) {
    case "active":
      return "live";
    case "scheduled":
      return "info";
    case "draft":
      return "neutral";
    case "ended":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function artistStatusToBadgeVariant(status: ArtistStatus): StatusBadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    case "merged_into":
      return "neutral";
    default:
      return "neutral";
  }
}

export function submissionStatusToBadgeVariant(status: ItemSubmissionStatus): StatusBadgeVariant {
  switch (status) {
    case "approved":
    case "converted":
      return "success";
    case "submitted":
      return "info";
    case "under_review":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export type CategoryLifecycleStatus = "active" | "archived";

export const categoryLifecycleLabel: Record<CategoryLifecycleStatus, string> = {
  active: "Active",
  archived: "Archived",
};

export function categoryLifecycleToBadgeVariant(
  status: CategoryLifecycleStatus,
): StatusBadgeVariant {
  switch (status) {
    case "archived":
      return "danger";
    case "active":
      return "success";
    default:
      return "neutral";
  }
}
