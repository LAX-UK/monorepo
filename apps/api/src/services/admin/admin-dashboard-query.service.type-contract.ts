import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type {
  IAdminCatalogListSummariesQueryService,
  IAdminDashboardMetricsService,
  IAdminKpiTrendsQueryService,
  IAdminNavCountsQueryService,
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
