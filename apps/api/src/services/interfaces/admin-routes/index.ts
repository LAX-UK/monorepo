export type {
  AdminCatalogRouteServices,
  IAdminCatalogApplicationService,
  IAdminConditionReportsApplicationService,
  IAdminLotFulfilmentApplicationService,
  IAdminLotsApplicationService,
  IAdminQrCodesApplicationService,
  IAdminSaleRegistrationsApplicationService,
} from "./admin-catalog-routes.js";

export type {
  AdminFinanceRouteServices,
  FinanceIssueSnapshot,
  IAdminDashboardMetricsService,
  IAdminFinanceDashboardQueryService,
  IAdminPaymentsApplicationService,
  IAdminStripeConnectApplicationService,
  IXeroAdminApplicationService,
  XeroConnectionHealth,
  XeroStatusPayload,
} from "./admin-finance-routes.js";
export type {
  AdminKpiPeriodDays,
  AdminKpiTrendBundle,
  AdminNavCounts,
} from "./admin-finance-routes.js";

export type {
  AdminComplianceRouteServices,
  AdminDisputeCaseRow,
  AdminDisputeCaseSummary,
  DisputeCaseListFilter,
  IAdminAmlApplicationService,
  IAdminDisputeCaseQueryService,
  IAdminLegalEntityLifecycleApplicationService,
  IAdminSourceOfFundsApplicationService,
} from "./admin-compliance-routes.js";

export type {
  AdminImpersonationLookupResult,
  AdminImpersonationRecordFailedEndResult,
  AdminImpersonationStartResult,
  AdminPeopleRouteServices,
  IAdminImpersonationService,
  IAdminInvitationApplicationService,
  IAdminUserApplicationService,
} from "./admin-people-routes.js";

export type {
  AdminLiveBiddingRateLimitError,
  AdminOperationsRouteServices,
  AdminPlacePaddleBidResult,
  ConveyorPipelineRowDto,
  IAdminDashboardQueryService,
  IAdminDomainEventQueryService,
  IAdminEmailApplicationService,
  IAdminLiveBiddingApplicationService,
  IAdminOpsReadService,
  IAdminRequestLifecycleService,
  IAdminSaleroomApplicationService,
  IAdminSaleroomCheckInApplicationService,
  IAdminSaleroomDisplayService,
  RedactedDomainEventRow,
} from "./admin-operations-routes.js";
export type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
  AdminLegalEntityBrowseRow,
} from "./admin-operations-routes.js";

import type { AdminCatalogRouteServices } from "./admin-catalog-routes.js";
import type { AdminComplianceRouteServices } from "./admin-compliance-routes.js";
import type { AdminFinanceRouteServices } from "./admin-finance-routes.js";
import type { AdminOperationsRouteServices } from "./admin-operations-routes.js";
import type { AdminPeopleRouteServices } from "./admin-people-routes.js";

export type AdminRouteServices = AdminCatalogRouteServices &
  AdminFinanceRouteServices &
  AdminComplianceRouteServices &
  AdminPeopleRouteServices &
  AdminOperationsRouteServices;
