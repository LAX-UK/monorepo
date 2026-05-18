import type { StatusBadge } from "@auction/ui";
import type { ComponentProps } from "react";

type BadgeVariant = ComponentProps<typeof StatusBadge>["variant"];

export function kycStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "approved":
      return "Verified";
    case "pending":
      return "Pending";
    case "rejected":
      return "Failed";
    default:
      return "Not started";
  }
}

export function kycStatusBadgeVariant(status: string | null | undefined): BadgeVariant {
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
