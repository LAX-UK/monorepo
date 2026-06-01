import type { AdminAttentionRow } from "@/lib/admin/admin-home-types";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";

/** Nav-count-driven queue rows prepended to the admin home attention widget. */
export function buildSyntheticAttentionRows(nav: AdminNavCounts): AdminAttentionRow[] {
  const rows: AdminAttentionRow[] = [];

  if (nav.withdrawalsPending > 0) {
    rows.push({
      id: "nav-withdrawals",
      title: `${nav.withdrawalsPending} withdrawal${nav.withdrawalsPending === 1 ? "" : "s"} pending`,
      hint: "Seller requests on lots attention lens",
      href: "/admin/lots?lens=attention",
      ctaLabel: "Open queue",
    });
  }
  if (nav.draftLotsMissingPhotos > 0) {
    rows.push({
      id: "nav-draft-photos",
      title: `${nav.draftLotsMissingPhotos} draft${nav.draftLotsMissingPhotos === 1 ? "" : "s"} missing photos`,
      hint: "Catalogue images needed before publish",
      href: "/admin/lots?lens=attention",
      ctaLabel: "Open queue",
    });
  }
  if (nav.draftSalesNeedingSetup > 0) {
    rows.push({
      id: "nav-sales-setup",
      title: `${nav.draftSalesNeedingSetup} draft sale${nav.draftSalesNeedingSetup === 1 ? "" : "s"} need setup`,
      hint: "Sales setup lens",
      href: "/admin/sales?lens=setup",
      ctaLabel: "Open sales",
    });
  }
  if (nav.conditionReportsPending > 0) {
    rows.push({
      id: "nav-condition-reports",
      title: `${nav.conditionReportsPending} condition report${nav.conditionReportsPending === 1 ? "" : "s"} open`,
      hint: "Buyer-requested reports",
      href: "/admin/condition-reports",
      ctaLabel: "Open queue",
    });
  }
  if (nav.lotFulfilmentPending > 0) {
    rows.push({
      id: "nav-fulfilment",
      title: `${nav.lotFulfilmentPending} lot${nav.lotFulfilmentPending === 1 ? "" : "s"} in fulfilment`,
      hint: "Release and shipping workflow",
      href: "/admin/lot-fulfilment",
      ctaLabel: "Open queue",
    });
  }
  if (nav.amlScreeningsPending > 0) {
    rows.push({
      id: "nav-aml-screenings",
      title: `${nav.amlScreeningsPending} AML screening${nav.amlScreeningsPending === 1 ? "" : "s"} pending`,
      hint: "Watchlist match — triage and MLRO decide",
      href: "/admin/compliance/aml",
      ctaLabel: "Open queue",
    });
  }
  if (nav.sourceOfFundsPending > 0) {
    rows.push({
      id: "nav-sof-cases",
      title: `${nav.sourceOfFundsPending} Source of Funds case${nav.sourceOfFundsPending === 1 ? "" : "s"} pending`,
      hint: "Settlement gated until MLRO approval",
      href: "/admin/compliance/source-of-funds",
      ctaLabel: "Open queue",
    });
  }

  return rows;
}
