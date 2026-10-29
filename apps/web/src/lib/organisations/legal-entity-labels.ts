import type { LegalEntitySubkind } from "@auction/types";

/**
 * Organisation type labels and the document review tone. Role words live in
 * `lib/presenters/organisation-role`, and the organisation's state as clients read it in
 * `lib/presenters/organisation-status`.
 */

/** Maps to `@auction/ui` `StatusBadge` variants. */
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

export function subkindLabel(subkind: LegalEntitySubkind | string): string {
  if (subkind in SUBKIND_LABELS) {
    return SUBKIND_LABELS[subkind as LegalEntitySubkind];
  }
  return subkind.replace(/_/g, " ");
}

/** KYB document review row (when API includes `documents` on entity payload). */
export function documentReviewStatusBadgeVariant(
  reviewStatus: "pending" | "approved" | "rejected",
): OrgStatusBadgeVariant {
  if (reviewStatus === "approved") return "success";
  if (reviewStatus === "rejected") return "danger";
  return "warning";
}
