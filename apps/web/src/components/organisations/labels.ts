import type { LegalEntityMemberRole, LegalEntityStatus, LegalEntitySubkind } from "@auction/types";

/** Maps to `@auction/ui` `StatusBadge` variants for organisation KYB status. */
export type OrgStatusBadgeVariant = "neutral" | "info" | "success" | "warning" | "danger" | "live";

const SUBKIND_LABELS: Record<LegalEntitySubkind, string> = {
  artist: "Artist",
  private_collector: "Private collector",
  gallery: "Gallery",
  dealer: "Dealer",
  estate: "Estate",
  company: "Company",
  charity: "Charity",
  institution: "Institution",
  lax_stock: "LAX stock",
  other: "Other",
};

const ROLE_LABELS: Record<LegalEntityMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  consignor: "Consignor",
  finance: "Finance",
  buyer_agent: "Buyer agent",
  viewer: "Viewer",
  specialist: "Specialist",
  staff: "Staff",
};

const STATUS_LABELS: Record<LegalEntityStatus, string> = {
  lead: "Setup",
  docs_requested: "Documents requested",
  docs_received: "Documents received",
  under_review: "Under review",
  connect_pending: "Connect pending",
  approved: "Approved",
  restricted: "Restricted",
  rejected: "Rejected",
  archived: "Archived",
};

export function subkindLabel(subkind: LegalEntitySubkind | string): string {
  if (subkind in SUBKIND_LABELS) {
    return SUBKIND_LABELS[subkind as LegalEntitySubkind];
  }
  return subkind.replace(/_/g, " ");
}

export function roleLabel(role: LegalEntityMemberRole | string): string {
  if (role in ROLE_LABELS) {
    return ROLE_LABELS[role as LegalEntityMemberRole];
  }
  return role.replace(/_/g, " ");
}

export function statusLabel(status: LegalEntityStatus): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function statusBadgeVariant(status: LegalEntityStatus): OrgStatusBadgeVariant {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "restricted") return "danger";
  if (status === "archived") return "neutral";
  if (status === "under_review") return "info";
  if (
    status === "lead" ||
    status === "docs_requested" ||
    status === "docs_received" ||
    status === "connect_pending"
  ) {
    return "warning";
  }
  return "neutral";
}

/** KYB document review row (when API includes `documents` on entity payload). */
export function documentReviewStatusBadgeVariant(
  reviewStatus: "pending" | "approved" | "rejected",
): OrgStatusBadgeVariant {
  if (reviewStatus === "approved") return "success";
  if (reviewStatus === "rejected") return "danger";
  return "warning";
}
