import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { describe, expect, it } from "vitest";
import { financeAttention, financeTools } from "./finance-hub.vm";

const issues = {
  failedPayoutCount: 2,
  legalEntitiesWithStripeConnectRequirementsCount: 1,
  staleBlockedScheduledPayoutCount: 0,
  entitiesPendingReviewCount: 3,
  artistsPendingApprovalCount: 0,
  staleKycSessionsCount: 0,
  documentsAwaitingReviewCount: 4,
  staleLeadOrganisationsCount: 0,
};

describe("finance hub view model", () => {
  it("lists every queue with its filtered list, most urgent first", () => {
    const items = financeAttention({ ...EMPTY_ADMIN_NAV_COUNTS, disputesOpen: 1 }, issues, 2);
    expect(items[0]).toMatchObject({
      id: "failed-payouts",
      count: 2,
      label: "payouts failed or were reversed",
      href: "/admin/payouts?status=failed",
      tone: "danger",
    });
    expect(items.find((item) => item.id === "disputes")?.label).toBe("dispute is open");
    expect(items.find((item) => item.id === "connect")?.href).toBe(
      "/admin/legal-entities?stripe=1",
    );
    expect(items.find((item) => item.id === "documents")?.href).toBe(
      "/admin/onboarding-issues?tab=documents",
    );
  });

  it("keeps the nav queues when the finance issues could not load", () => {
    const items = financeAttention(EMPTY_ADMIN_NAV_COUNTS, null, 0);
    expect(items.map((item) => item.id)).toEqual(["failed-payouts", "disputes", "manual-review"]);
  });

  it("links every finance tool, with what waits there", () => {
    const tools = financeTools({ ...EMPTY_ADMIN_NAV_COUNTS, payoutsFailed: 5 });
    expect(tools.map((tool) => tool.href)).toEqual([
      "/admin/payments",
      "/admin/payouts",
      "/admin/payouts/settlement",
      "/admin/disputes",
      "/admin/integrations/xero",
    ]);
    expect(tools.find((tool) => tool.id === "payouts")?.count).toBe(5);
  });
});
