import type { AdminAttentionRow } from "@/lib/admin/admin-home-types";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";

function word(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** Nav-count-driven queue rows prepended to the admin home attention widget. */
export function buildSyntheticAttentionRows(nav: AdminNavCounts): AdminAttentionRow[] {
  const rows: AdminAttentionRow[] = [];

  // Finance / compliance (highest urgency — matches danger nav badges)
  if (nav.manualReviewCount > 0) {
    rows.push({
      id: "nav-manual-review",
      domain: "Finance",
      title: `${nav.manualReviewCount} ${word(nav.manualReviewCount, "payment needs", "payments need")} manual review`,
      hint: "AML, Source of Funds, or policy holds blocking settlement",
      href: "/admin/payments?manualReview=1",
      ctaLabel: "Review payments",
    });
  }
  if (nav.disputesOpen > 0) {
    rows.push({
      id: "nav-disputes",
      domain: "Finance",
      title: `${nav.disputesOpen} open dispute ${word(nav.disputesOpen, "case", "cases")}`,
      hint: "Stripe chargebacks requiring response or evidence",
      href: "/admin/disputes?status=open",
      ctaLabel: "Open disputes",
    });
  }
  if (nav.payoutsFailed > 0) {
    rows.push({
      id: "nav-payouts-failed",
      domain: "Finance",
      title: `${nav.payoutsFailed} failed ${word(nav.payoutsFailed, "payout", "payouts")}`,
      hint: "Seller transfers that need investigation or retry",
      href: "/admin/payouts?status=failed",
      ctaLabel: "Open payouts",
    });
  }
  if (nav.amlScreeningsPending > 0) {
    rows.push({
      id: "nav-aml-screenings",
      domain: "Compliance",
      title: `${nav.amlScreeningsPending} AML ${word(nav.amlScreeningsPending, "screening", "screenings")} pending`,
      hint: "Watchlist match — triage and MLRO decide",
      href: "/admin/compliance/aml",
      ctaLabel: "Open queue",
    });
  }
  if (nav.sourceOfFundsPending > 0) {
    rows.push({
      id: "nav-sof-cases",
      domain: "Compliance",
      title: `${nav.sourceOfFundsPending} Source of Funds ${word(nav.sourceOfFundsPending, "case", "cases")} pending`,
      hint: "Settlement gated until MLRO approval",
      href: "/admin/compliance/source-of-funds",
      ctaLabel: "Open queue",
    });
  }

  // People / onboarding
  if (nav.onboardingIssuesTotal > 0) {
    rows.push({
      id: "nav-onboarding-issues",
      domain: "People",
      title: `${nav.onboardingIssuesTotal} onboarding ${word(nav.onboardingIssuesTotal, "issue", "issues")}`,
      hint: "KYC, entities, or org setup blocking go-live",
      href: "/admin/onboarding-issues",
      ctaLabel: "Open queue",
    });
  }
  if (nav.invitationsPending > 0) {
    rows.push({
      id: "nav-invitations",
      domain: "People",
      title: `${nav.invitationsPending} pending ${word(nav.invitationsPending, "invitation", "invitations")}`,
      hint: "Staff or client invites awaiting acceptance",
      href: "/admin/invitations",
      ctaLabel: "View invitations",
    });
  }

  // Catalog
  if (nav.submissionsPending > 0) {
    rows.push({
      id: "nav-submissions",
      domain: "Catalog",
      title: `${nav.submissionsPending} ${word(nav.submissionsPending, "submission", "submissions")} pending review`,
      hint: "Seller consignments awaiting catalog decision",
      href: "/admin/submissions",
      ctaLabel: "Open submissions",
    });
  }
  if (nav.artistsPending > 0) {
    rows.push({
      id: "nav-artists",
      domain: "Catalog",
      title: `${nav.artistsPending} ${word(nav.artistsPending, "artist", "artists")} pending review`,
      hint: "New artist records awaiting approval",
      href: "/admin/artists",
      ctaLabel: "Open artists",
    });
  }
  if (nav.withdrawalsPending > 0) {
    rows.push({
      id: "nav-withdrawals",
      domain: "Catalog",
      title: `${nav.withdrawalsPending} ${word(nav.withdrawalsPending, "withdrawal", "withdrawals")} pending`,
      hint: "Seller requests on lots attention lens",
      href: "/admin/lots?lens=attention",
      ctaLabel: "Open queue",
    });
  }
  if (nav.draftLotsMissingPhotos > 0) {
    rows.push({
      id: "nav-draft-photos",
      domain: "Catalog",
      title: `${nav.draftLotsMissingPhotos} ${word(nav.draftLotsMissingPhotos, "draft", "drafts")} missing photos`,
      hint: "Catalogue images needed before publish",
      href: "/admin/lots?lens=attention",
      ctaLabel: "Open queue",
    });
  }
  if (nav.draftSalesNeedingSetup > 0) {
    rows.push({
      id: "nav-sales-setup",
      domain: "Catalog",
      title: `${nav.draftSalesNeedingSetup} draft ${word(nav.draftSalesNeedingSetup, "sale needs", "sales need")} setup`,
      hint: "Sales setup lens",
      href: "/admin/sales?lens=setup",
      ctaLabel: "Open sales",
    });
  }

  // Operations
  if (nav.saleroomLiveCount > 0) {
    rows.push({
      id: "nav-saleroom-live",
      domain: "Operations",
      title: `${nav.saleroomLiveCount} live ${word(nav.saleroomLiveCount, "sale", "sales")} in saleroom`,
      hint: "Onsite or hybrid sales currently running",
      href: "/admin/saleroom",
      ctaLabel: "Open saleroom",
    });
  }
  if (nav.telephoneBookingsPending > 0) {
    rows.push({
      id: "nav-telephone-bookings",
      domain: "Operations",
      title: `${nav.telephoneBookingsPending} telephone ${word(nav.telephoneBookingsPending, "line", "lines")} awaiting confirmation`,
      hint: "Onsite sale telephone bidding queue",
      href: "/admin/saleroom",
      ctaLabel: "Open saleroom",
    });
  }
  if (nav.conditionReportsPending > 0) {
    rows.push({
      id: "nav-condition-reports",
      domain: "Operations",
      title: `${nav.conditionReportsPending} condition ${word(nav.conditionReportsPending, "report", "reports")} open`,
      hint: "Buyer-requested reports",
      href: "/admin/condition-reports",
      ctaLabel: "Open queue",
    });
  }
  if (nav.lotFulfilmentPending > 0) {
    rows.push({
      id: "nav-fulfilment",
      domain: "Operations",
      title: `${nav.lotFulfilmentPending} ${word(nav.lotFulfilmentPending, "lot", "lots")} in fulfilment`,
      hint: "Release and shipping workflow",
      href: "/admin/lot-fulfilment",
      ctaLabel: "Open queue",
    });
  }

  return rows;
}
