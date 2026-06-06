import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { describe, expect, it } from "vitest";
import { buildSyntheticAttentionRows } from "./build-synthetic-attention-rows";

const NAV_COUNT_KEYS = [
  "manualReviewCount",
  "disputesOpen",
  "payoutsFailed",
  "amlScreeningsPending",
  "sourceOfFundsPending",
  "onboardingIssuesTotal",
  "invitationsPending",
  "submissionsPending",
  "artistsPending",
  "withdrawalsPending",
  "draftLotsMissingPhotos",
  "draftSalesNeedingSetup",
  "saleroomLiveCount",
  "telephoneBookingsPending",
  "conditionReportsPending",
  "lotFulfilmentPending",
] as const;

const EXPECTED_IDS: Record<(typeof NAV_COUNT_KEYS)[number], string> = {
  manualReviewCount: "nav-manual-review",
  disputesOpen: "nav-disputes",
  payoutsFailed: "nav-payouts-failed",
  amlScreeningsPending: "nav-aml-screenings",
  sourceOfFundsPending: "nav-sof-cases",
  onboardingIssuesTotal: "nav-onboarding-issues",
  invitationsPending: "nav-invitations",
  submissionsPending: "nav-submissions",
  artistsPending: "nav-artists",
  withdrawalsPending: "nav-withdrawals",
  draftLotsMissingPhotos: "nav-draft-photos",
  draftSalesNeedingSetup: "nav-sales-setup",
  saleroomLiveCount: "nav-saleroom-live",
  telephoneBookingsPending: "nav-telephone-bookings",
  conditionReportsPending: "nav-condition-reports",
  lotFulfilmentPending: "nav-fulfilment",
};

describe("buildSyntheticAttentionRows", () => {
  it("returns empty when all nav counts are zero", () => {
    expect(buildSyntheticAttentionRows(EMPTY_ADMIN_NAV_COUNTS)).toEqual([]);
  });

  it.each(NAV_COUNT_KEYS)("emits row when %s > 0", (key) => {
    const rows = buildSyntheticAttentionRows({
      ...EMPTY_ADMIN_NAV_COUNTS,
      [key]: 3,
    });
    expect(rows.some((r) => r.id === EXPECTED_IDS[key])).toBe(true);
  });

  it("orders finance and compliance before catalog queues", () => {
    const rows = buildSyntheticAttentionRows({
      ...EMPTY_ADMIN_NAV_COUNTS,
      submissionsPending: 5,
      manualReviewCount: 2,
      amlScreeningsPending: 1,
    });
    const ids = rows.map((r) => r.id);
    expect(ids.indexOf("nav-manual-review")).toBeLessThan(ids.indexOf("nav-aml-screenings"));
    expect(ids.indexOf("nav-aml-screenings")).toBeLessThan(ids.indexOf("nav-submissions"));
  });

  it("includes deep links for fulfilment and condition reports", () => {
    const rows = buildSyntheticAttentionRows({
      ...EMPTY_ADMIN_NAV_COUNTS,
      lotFulfilmentPending: 2,
      conditionReportsPending: 1,
    });
    expect(rows.some((r) => r.href === "/admin/lot-fulfilment")).toBe(true);
    expect(rows.some((r) => r.href === "/admin/condition-reports")).toBe(true);
  });

  it("maps finance nav badges to correct hrefs", () => {
    const rows = buildSyntheticAttentionRows({
      ...EMPTY_ADMIN_NAV_COUNTS,
      manualReviewCount: 1,
      disputesOpen: 2,
      payoutsFailed: 3,
    });
    expect(rows.find((r) => r.id === "nav-manual-review")?.href).toBe(
      "/admin/payments?manualReview=1",
    );
    expect(rows.find((r) => r.id === "nav-disputes")?.href).toBe("/admin/disputes?status=open");
    expect(rows.find((r) => r.id === "nav-payouts-failed")?.href).toBe(
      "/admin/payouts?status=failed",
    );
  });
});
