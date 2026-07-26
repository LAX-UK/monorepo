import type { StaffAttentionItem } from "@/lib/admin/staff-attention.types";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import {
  AML_REVIEW_ACCESS,
  type CapabilityRequirement,
  FINANCE_ACCESS,
  type UserRole,
  type UserStaffRole,
  userHasAccessTo,
} from "@auction/types";

type StaffHeaderAttentionSpec = {
  id: string;
  countKey: keyof AdminNavCounts;
  requirement: CapabilityRequirement;
  buildItem: (count: number) => Pick<StaffAttentionItem, "label" | "href" | "hint">;
};

/**
 * Compact header-bell items derived from the same nav-count keys as dashboard
 * ATTENTION_ROW_SPECS. Excludes submissions (header shortcut removed by design).
 */
export const STAFF_HEADER_ATTENTION_SPECS: readonly StaffHeaderAttentionSpec[] = [
  {
    id: "nav-manual-review",
    countKey: "manualReviewCount",
    requirement: FINANCE_ACCESS,
    buildItem: () => ({
      label: "Payments — manual review",
      href: "/admin/payments?manualReview=1",
      hint: "AML, Source of Funds, or policy holds blocking settlement",
    }),
  },
  {
    id: "nav-disputes",
    countKey: "disputesOpen",
    requirement: FINANCE_ACCESS,
    buildItem: (count) => ({
      label: `${count} open dispute${count === 1 ? "" : "s"}`,
      href: "/admin/disputes?status=open",
      hint: "Stripe chargebacks requiring response or evidence",
    }),
  },
  {
    id: "nav-payouts-failed",
    countKey: "payoutsFailed",
    requirement: FINANCE_ACCESS,
    buildItem: (count) => ({
      label: `${count} failed payout${count === 1 ? "" : "s"}`,
      href: "/admin/payouts?status=failed",
      hint: "Seller transfers that need investigation or retry",
    }),
  },
  {
    id: "nav-aml-screenings",
    countKey: "amlScreeningsPending",
    requirement: AML_REVIEW_ACCESS,
    buildItem: (count) => ({
      label: `${count} AML screening${count === 1 ? "" : "s"} pending`,
      href: "/admin/compliance/aml",
      hint: "Watchlist match — triage and MLRO decide",
    }),
  },
  {
    id: "nav-sof-cases",
    countKey: "sourceOfFundsPending",
    requirement: AML_REVIEW_ACCESS,
    buildItem: (count) => ({
      label: `${count} Source of Funds case${count === 1 ? "" : "s"}`,
      href: "/admin/compliance/source-of-funds",
      hint: "Settlement gated until MLRO approval",
    }),
  },
];

export function buildStaffHeaderAttentionItems(
  navCounts: AdminNavCounts,
  role: UserRole = "staff",
  staffRole: UserStaffRole | null = null,
): StaffAttentionItem[] {
  const items: StaffAttentionItem[] = [];

  for (const spec of STAFF_HEADER_ATTENTION_SPECS) {
    const count = navCounts[spec.countKey];
    if (count <= 0) continue;
    if (!userHasAccessTo(role, staffRole, spec.requirement)) continue;

    const { label, href, hint } = spec.buildItem(count);
    items.push({
      id: spec.id,
      label,
      href,
      count,
      ...(hint ? { hint } : {}),
    });
  }

  return items;
}
