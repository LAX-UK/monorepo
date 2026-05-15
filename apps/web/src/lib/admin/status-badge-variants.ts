import type {
  ArtistStatus,
  ItemSubmissionStatus,
  LotStatus,
  PaymentStatus,
  SaleStatus,
} from "@auction/types";

/** Matches `StatusBadge` `variant` prop in `@auction/ui`. */
export type AdminStatusBadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "live";

// ---------------------------------------------------------------------------
// Human-readable labels – single source of truth for all catalog statuses
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Variant mappers for StatusBadge
// ---------------------------------------------------------------------------

/** Maps catalog lot lifecycle to `StatusBadge` variants (OCP: extend map, not callers). */
export function lotStatusToBadgeVariant(status: LotStatus | string): AdminStatusBadgeVariant {
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

export function saleStatusToBadgeVariant(status: SaleStatus): AdminStatusBadgeVariant {
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

export function artistStatusToBadgeVariant(status: ArtistStatus): AdminStatusBadgeVariant {
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

export function submissionStatusToBadgeVariant(
  status: ItemSubmissionStatus,
): AdminStatusBadgeVariant {
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

export function paymentStatusToBadgeVariant(status: PaymentStatus): AdminStatusBadgeVariant {
  switch (status) {
    case "captured":
      return "success";
    case "authorized":
      return "info";
    case "pending":
    case "requires_manual_review":
      return "warning";
    case "refunded":
      return "neutral";
    default:
      return "neutral";
  }
}
