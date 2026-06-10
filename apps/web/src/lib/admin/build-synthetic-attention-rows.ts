import type { AdminAttentionRow, AttentionDomain } from "@/lib/admin/admin-home-types";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import {
  AML_REVIEW_ACCESS,
  ARTIST_REVIEW_ACCESS,
  CONDITION_REPORTS_ACCESS,
  type CapabilityRequirement,
  FINANCE_ACCESS,
  INVITATIONS_ACCESS,
  LOTS_ACCESS,
  LOT_FULFILMENT_ACCESS,
  ONBOARDING_QUEUES_ACCESS,
  SALEROOM_ACCESS,
  SALE_CATALOG_ACCESS,
  SUBMISSIONS_ACCESS,
  type UserRole,
  type UserStaffRole,
  userHasAccessTo,
} from "@auction/types";

function word(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

type AttentionRowSpec = {
  id: string;
  domain: AttentionDomain;
  countKey: keyof AdminNavCounts;
  requirement: CapabilityRequirement;
  buildRow: (count: number) => Omit<AdminAttentionRow, "id" | "domain">;
};

/**
 * Declarative spec table for synthetic attention rows.
 * Each entry maps a nav count key to its target route's capability requirement.
 * Order defines display priority (Finance/Compliance first, then People, Catalog, Operations).
 */
const ATTENTION_ROW_SPECS: readonly AttentionRowSpec[] = [
  // Finance / Compliance (highest urgency)
  {
    id: "nav-manual-review",
    domain: "Finance",
    countKey: "manualReviewCount",
    requirement: FINANCE_ACCESS,
    buildRow: (count) => ({
      title: `${count} ${word(count, "payment needs", "payments need")} manual review`,
      hint: "AML, Source of Funds, or policy holds blocking settlement",
      href: "/admin/payments?manualReview=1",
      ctaLabel: "Review payments",
    }),
  },
  {
    id: "nav-disputes",
    domain: "Finance",
    countKey: "disputesOpen",
    requirement: FINANCE_ACCESS,
    buildRow: (count) => ({
      title: `${count} open dispute ${word(count, "case", "cases")}`,
      hint: "Stripe chargebacks requiring response or evidence",
      href: "/admin/disputes?status=open",
      ctaLabel: "Open disputes",
    }),
  },
  {
    id: "nav-payouts-failed",
    domain: "Finance",
    countKey: "payoutsFailed",
    requirement: FINANCE_ACCESS,
    buildRow: (count) => ({
      title: `${count} failed ${word(count, "payout", "payouts")}`,
      hint: "Seller transfers that need investigation or retry",
      href: "/admin/payouts?status=failed",
      ctaLabel: "Open payouts",
    }),
  },
  {
    id: "nav-aml-screenings",
    domain: "Compliance",
    countKey: "amlScreeningsPending",
    requirement: AML_REVIEW_ACCESS,
    buildRow: (count) => ({
      title: `${count} AML ${word(count, "screening", "screenings")} pending`,
      hint: "Watchlist match — triage and MLRO decide",
      href: "/admin/compliance/aml",
      ctaLabel: "Open queue",
    }),
  },
  {
    id: "nav-sof-cases",
    domain: "Compliance",
    countKey: "sourceOfFundsPending",
    requirement: AML_REVIEW_ACCESS,
    buildRow: (count) => ({
      title: `${count} Source of Funds ${word(count, "case", "cases")} pending`,
      hint: "Settlement gated until MLRO approval",
      href: "/admin/compliance/source-of-funds",
      ctaLabel: "Open queue",
    }),
  },
  // People / onboarding
  {
    id: "nav-onboarding-issues",
    domain: "People",
    countKey: "onboardingIssuesTotal",
    requirement: ONBOARDING_QUEUES_ACCESS,
    buildRow: (count) => ({
      title: `${count} onboarding ${word(count, "issue", "issues")}`,
      hint: "KYC, entities, or org setup blocking go-live",
      href: "/admin/onboarding-issues",
      ctaLabel: "Open queue",
    }),
  },
  {
    id: "nav-invitations",
    domain: "People",
    countKey: "invitationsPending",
    requirement: INVITATIONS_ACCESS,
    buildRow: (count) => ({
      title: `${count} pending ${word(count, "invitation", "invitations")}`,
      hint: "Staff or client invites awaiting acceptance",
      href: "/admin/invitations",
      ctaLabel: "View invitations",
    }),
  },
  // Catalog
  {
    id: "nav-submissions",
    domain: "Catalog",
    countKey: "submissionsPending",
    requirement: SUBMISSIONS_ACCESS,
    buildRow: (count) => ({
      title: `${count} ${word(count, "submission", "submissions")} pending review`,
      hint: "Seller consignments awaiting catalog decision",
      href: "/admin/submissions",
      ctaLabel: "Open submissions",
    }),
  },
  {
    id: "nav-artists",
    domain: "Catalog",
    countKey: "artistsPending",
    requirement: ARTIST_REVIEW_ACCESS,
    buildRow: (count) => ({
      title: `${count} ${word(count, "artist", "artists")} pending review`,
      hint: "New artist records awaiting approval",
      href: "/admin/artists",
      ctaLabel: "Open artists",
    }),
  },
  {
    id: "nav-withdrawals",
    domain: "Catalog",
    countKey: "withdrawalsPending",
    requirement: LOTS_ACCESS,
    buildRow: (count) => ({
      title: `${count} ${word(count, "withdrawal", "withdrawals")} pending`,
      hint: "Seller requests on lots attention lens",
      href: "/admin/lots?lens=attention",
      ctaLabel: "Open queue",
    }),
  },
  {
    id: "nav-draft-photos",
    domain: "Catalog",
    countKey: "draftLotsMissingPhotos",
    requirement: LOTS_ACCESS,
    buildRow: (count) => ({
      title: `${count} ${word(count, "draft", "drafts")} missing photos`,
      hint: "Catalogue images needed before publish",
      href: "/admin/lots?lens=attention",
      ctaLabel: "Open queue",
    }),
  },
  {
    id: "nav-sales-setup",
    domain: "Catalog",
    countKey: "draftSalesNeedingSetup",
    requirement: SALE_CATALOG_ACCESS,
    buildRow: (count) => ({
      title: `${count} draft ${word(count, "sale needs", "sales need")} setup`,
      hint: "Sales setup lens",
      href: "/admin/sales?lens=setup",
      ctaLabel: "Open sales",
    }),
  },
  // Operations
  {
    id: "nav-saleroom-live",
    domain: "Operations",
    countKey: "saleroomLiveCount",
    requirement: SALEROOM_ACCESS,
    buildRow: (count) => ({
      title: `${count} live ${word(count, "sale", "sales")} in saleroom`,
      hint: "Onsite or hybrid sales currently running",
      href: "/admin/saleroom",
      ctaLabel: "Open saleroom",
    }),
  },
  {
    id: "nav-telephone-bookings",
    domain: "Operations",
    countKey: "telephoneBookingsPending",
    requirement: SALEROOM_ACCESS,
    buildRow: (count) => ({
      title: `${count} telephone ${word(count, "line", "lines")} awaiting confirmation`,
      hint: "Onsite sale telephone bidding queue",
      href: "/admin/saleroom",
      ctaLabel: "Open saleroom",
    }),
  },
  {
    id: "nav-condition-reports",
    domain: "Operations",
    countKey: "conditionReportsPending",
    requirement: CONDITION_REPORTS_ACCESS,
    buildRow: (count) => ({
      title: `${count} condition ${word(count, "report", "reports")} open`,
      hint: "Buyer-requested reports",
      href: "/admin/condition-reports",
      ctaLabel: "Open queue",
    }),
  },
  {
    id: "nav-fulfilment",
    domain: "Operations",
    countKey: "lotFulfilmentPending",
    requirement: LOT_FULFILMENT_ACCESS,
    buildRow: (count) => ({
      title: `${count} ${word(count, "lot", "lots")} in fulfilment`,
      hint: "Release and shipping workflow",
      href: "/admin/lot-fulfilment",
      ctaLabel: "Open queue",
    }),
  },
];

/**
 * Nav-count-driven queue rows prepended to the admin home attention widget.
 * Only includes rows the viewer can access based on their role capabilities.
 */
export function buildSyntheticAttentionRows(
  nav: AdminNavCounts,
  role: UserRole = "staff",
  staffRole: UserStaffRole | null = null,
): AdminAttentionRow[] {
  const rows: AdminAttentionRow[] = [];

  for (const spec of ATTENTION_ROW_SPECS) {
    const count = nav[spec.countKey];
    if (count <= 0) continue;
    if (!userHasAccessTo(role, staffRole, spec.requirement)) continue;

    const { title, hint, href, ctaLabel } = spec.buildRow(count);
    rows.push({
      id: spec.id,
      domain: spec.domain,
      title,
      hint,
      href,
      ctaLabel,
    });
  }

  return rows;
}
