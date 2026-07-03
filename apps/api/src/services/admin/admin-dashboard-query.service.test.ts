import { describe, expect, it, vi } from "vitest";
import { AdminDashboardQueryService } from "./admin-dashboard-query.service.js";

describe("AdminDashboardQueryService facade", () => {
  it("delegates searchLegalEntitiesBrowse to legal entity browse service", async () => {
    const browseResult = { rows: [], total: 0 };
    const legalEntityBrowse = {
      searchLegalEntitiesBrowse: vi.fn().mockResolvedValue(browseResult),
    };
    const svc = new AdminDashboardQueryService({
      financeIssueSnapshot: {
        getFinanceIssueSnapshot: vi.fn(),
        listStripeConnectRequirementEntities: vi.fn(),
      },
      manualReviewPayments: {
        listManualReviewPayments: vi.fn(),
        countManualReviewPayments: vi.fn(),
      },
      onboardingIssues: {
        getOnboardingIssues: vi.fn(),
      },
      reviewTasks: {
        listPendingAdminReviewTasks: vi.fn(),
        countPendingAdminReviewTasks: vi.fn(),
      },
      legalEntityBrowse,
    });

    const params = { limit: 10, offset: 0 };
    await expect(svc.searchLegalEntitiesBrowse(params)).resolves.toEqual(browseResult);
    expect(legalEntityBrowse.searchLegalEntitiesBrowse).toHaveBeenCalledWith(params);
  });

  it("delegates countManualReviewPayments to manual review service", async () => {
    const manualReviewPayments = {
      listManualReviewPayments: vi.fn(),
      countManualReviewPayments: vi.fn().mockResolvedValue(7),
    };
    const svc = new AdminDashboardQueryService({
      financeIssueSnapshot: {
        getFinanceIssueSnapshot: vi.fn(),
        listStripeConnectRequirementEntities: vi.fn(),
      },
      manualReviewPayments,
      onboardingIssues: {
        getOnboardingIssues: vi.fn(),
      },
      reviewTasks: {
        listPendingAdminReviewTasks: vi.fn(),
        countPendingAdminReviewTasks: vi.fn(),
      },
      legalEntityBrowse: {
        searchLegalEntitiesBrowse: vi.fn(),
      },
    });

    await expect(svc.countManualReviewPayments()).resolves.toBe(7);
    expect(manualReviewPayments.countManualReviewPayments).toHaveBeenCalledOnce();
  });
});
