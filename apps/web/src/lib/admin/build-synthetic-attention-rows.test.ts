import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import { describe, expect, it } from "vitest";
import { buildSyntheticAttentionRows } from "./build-synthetic-attention-rows";

const FULL_NAV_COUNTS: AdminNavCounts = {
  submissionsPending: 5,
  artistsPending: 3,
  conditionReportsPending: 2,
  manualReviewCount: 1,
  onboardingIssuesTotal: 4,
  lotFulfilmentPending: 6,
  withdrawalsPending: 2,
  disputesOpen: 1,
  payoutsFailed: 1,
  saleroomLiveCount: 2,
  invitationsPending: 3,
  draftSalesNeedingSetup: 2,
  draftLotsMissingPhotos: 4,
  amlScreeningsPending: 1,
  sourceOfFundsPending: 2,
  telephoneBookingsPending: 1,
  legalEntityStripeRequirementsCount: 0,
};

describe("buildSyntheticAttentionRows", () => {
  it("super_admin sees all rows when counts are non-zero", () => {
    const rows = buildSyntheticAttentionRows(FULL_NAV_COUNTS, "staff", "super_admin");
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.map((r) => r.id)).toContain("nav-manual-review");
    expect(rows.map((r) => r.id)).toContain("nav-aml-screenings");
    expect(rows.map((r) => r.id)).toContain("nav-submissions");
    expect(rows.map((r) => r.id)).toContain("nav-saleroom-live");
    expect(rows.map((r) => r.id)).toContain("nav-fulfilment");
  });

  it("client_advisor only sees rows they can access (e.g., onboarding)", () => {
    const rows = buildSyntheticAttentionRows(FULL_NAV_COUNTS, "staff", "client_advisor");
    expect(rows.map((r) => r.id)).toContain("nav-onboarding-issues");
    expect(rows.map((r) => r.id)).not.toContain("nav-manual-review");
    expect(rows.map((r) => r.id)).not.toContain("nav-submissions");
    expect(rows.map((r) => r.id)).not.toContain("nav-saleroom-live");
    expect(rows.map((r) => r.id)).not.toContain("nav-aml-screenings");
  });

  it("finance_ops sees finance rows but not catalog or saleroom", () => {
    const rows = buildSyntheticAttentionRows(FULL_NAV_COUNTS, "staff", "finance_ops");
    expect(rows.map((r) => r.id)).toContain("nav-manual-review");
    expect(rows.map((r) => r.id)).toContain("nav-disputes");
    expect(rows.map((r) => r.id)).toContain("nav-payouts-failed");
    expect(rows.map((r) => r.id)).not.toContain("nav-submissions");
    expect(rows.map((r) => r.id)).not.toContain("nav-saleroom-live");
    expect(rows.map((r) => r.id)).not.toContain("nav-aml-screenings");
  });

  it("specialist sees submissions and condition reports but not finance", () => {
    const rows = buildSyntheticAttentionRows(FULL_NAV_COUNTS, "staff", "specialist");
    expect(rows.map((r) => r.id)).toContain("nav-submissions");
    expect(rows.map((r) => r.id)).toContain("nav-condition-reports");
    expect(rows.map((r) => r.id)).not.toContain("nav-manual-review");
    expect(rows.map((r) => r.id)).not.toContain("nav-saleroom-live");
  });

  it("compliance_officer sees AML and SoF queues", () => {
    const rows = buildSyntheticAttentionRows(FULL_NAV_COUNTS, "staff", "compliance_officer");
    expect(rows.map((r) => r.id)).toContain("nav-aml-screenings");
    expect(rows.map((r) => r.id)).toContain("nav-sof-cases");
    expect(rows.map((r) => r.id)).not.toContain("nav-manual-review");
    expect(rows.map((r) => r.id)).not.toContain("nav-submissions");
  });

  it("operations sees catalog, saleroom, and fulfilment rows", () => {
    const rows = buildSyntheticAttentionRows(FULL_NAV_COUNTS, "staff", "operations");
    expect(rows.map((r) => r.id)).toContain("nav-submissions");
    expect(rows.map((r) => r.id)).toContain("nav-saleroom-live");
    expect(rows.map((r) => r.id)).toContain("nav-fulfilment");
    expect(rows.map((r) => r.id)).toContain("nav-withdrawals");
    expect(rows.map((r) => r.id)).toContain("nav-sales-setup");
  });

  it("returns empty array when all counts are zero", () => {
    const emptyCounts: AdminNavCounts = {
      submissionsPending: 0,
      artistsPending: 0,
      conditionReportsPending: 0,
      manualReviewCount: 0,
      onboardingIssuesTotal: 0,
      lotFulfilmentPending: 0,
      withdrawalsPending: 0,
      disputesOpen: 0,
      payoutsFailed: 0,
      saleroomLiveCount: 0,
      invitationsPending: 0,
      draftSalesNeedingSetup: 0,
      draftLotsMissingPhotos: 0,
      amlScreeningsPending: 0,
      sourceOfFundsPending: 0,
      telephoneBookingsPending: 0,
      legalEntityStripeRequirementsCount: 0,
    };
    const rows = buildSyntheticAttentionRows(emptyCounts, "staff", "super_admin");
    expect(rows).toHaveLength(0);
  });

  it("returns empty array when staffRole is null (no capabilities)", () => {
    const rows = buildSyntheticAttentionRows(FULL_NAV_COUNTS, "staff", null);
    expect(rows).toHaveLength(0);
  });
});
