import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminFinanceHubPage } from "./load-finance-hub-page";

const { getFinanceIssues, getNavCounts } = vi.hoisted(() => ({
  getFinanceIssues: vi.fn(),
  getNavCounts: vi.fn(),
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminFinanceIssues: getFinanceIssues,
}));

vi.mock("@/lib/data/http/admin-nav-counts.server", () => ({
  getFinanceAdminNavCounts: getNavCounts,
}));

describe("loadAdminFinanceHubPage", () => {
  beforeEach(() => {
    getFinanceIssues.mockResolvedValue({
      failedPayoutCount: 2,
      manualReviewCount: 1,
      openDisputeCount: 0,
    });
    getNavCounts.mockResolvedValue({
      manualReviewCount: 1,
      disputesOpen: 0,
      payoutsFailed: 2,
    });
  });

  it("returns finance issues and nav counts", async () => {
    const result = await loadAdminFinanceHubPage();
    expect(result.financeIssues?.failedPayoutCount).toBe(2);
    expect(result.failedPayouts).toBe(2);
    expect(result.loadError).toBeNull();
  });

  it("captures load errors without throwing", async () => {
    getFinanceIssues.mockRejectedValue(new Error("forbidden"));
    const result = await loadAdminFinanceHubPage();
    expect(result.financeIssues).toBeNull();
    expect(result.loadError).toBe("forbidden");
  });
});
