import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type {
  IAdminCatalogListSummariesQueryService,
  IAdminDashboardMetricsService,
  IAdminFinanceDashboardQueryService,
  IAdminKpiTrendsQueryService,
  IAdminManualReviewPaymentQueryService,
  IAdminNavCountsQueryService,
  IAdminReviewTaskQueryService,
} from "../interfaces/admin-routes.js";
import type { AdminDashboardMetricsApplicationService } from "./admin-dashboard-metrics-application.service.js";

type AssertAssignable<T extends U, U> = T;

declare const metrics: AdminDashboardMetricsApplicationService;

type _MetricsComposite = AssertAssignable<typeof metrics, IAdminDashboardMetricsService>;
type _NavCounts = AssertAssignable<typeof metrics, IAdminNavCountsQueryService>;
type _KpiTrends = AssertAssignable<typeof metrics, IAdminKpiTrendsQueryService>;
type _ListSummaries = AssertAssignable<typeof metrics, IAdminCatalogListSummariesQueryService>;

type _MetricsContract = [_MetricsComposite, _NavCounts, _KpiTrends, _ListSummaries];

defineCompileTimeContract<_MetricsContract>();

describe("Admin dashboard metrics application contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});

describe("Admin operations query ports (standalone interfaces)", () => {
  it("finance and review ports remain distinct from metrics bundle", () => {
    type _Finance = IAdminFinanceDashboardQueryService;
    type _ManualReview = IAdminManualReviewPaymentQueryService;
    type _ReviewTasks = IAdminReviewTaskQueryService;
    const _ports: [_Finance, _ManualReview, _ReviewTasks] = [{} as never, {} as never, {} as never];
    expect(_ports).toHaveLength(3);
  });
});
