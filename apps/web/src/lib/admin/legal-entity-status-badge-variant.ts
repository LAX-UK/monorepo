import type { LegalEntityStatus } from "@auction/types";

type StatusBadgeVariant = "neutral" | "info" | "success" | "warning" | "danger" | "live";

export function legalEntityStatusToBadgeVariant(status: LegalEntityStatus): StatusBadgeVariant {
  switch (status) {
    case "approved":
    case "connect_pending":
      return "success";
    case "rejected":
    case "archived":
    case "restricted":
      return "danger";
    case "under_review":
    case "docs_received":
      return "info";
    case "docs_requested":
    case "lead":
      return "warning";
    default:
      return "neutral";
  }
}
