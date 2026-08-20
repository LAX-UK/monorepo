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
  IAdminCatalogListSummariesQueryService,
  IAdminDashboardMetricsService,
  IAdminFinanceDashboardQueryService,
  IAdminFinanceIssueSnapshotQueryService,
  IAdminKpiTrendsQueryService,
  IAdminManualReviewPaymentQueryService,
  IAdminNavCountsQueryService,
  IAdminPayoutApplicationService,
  IAdminPaymentsApplicationService,
  IAdminStripeConnectApplicationService,
  IXeroAdminApplicationService,
  StripeConnectRequirementEntityRow,
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
  AdminUserDetailResponse,
  IAdminImpersonationService,
  IAdminInvitationApplicationService,
  IAdminUserApplicationService,
} from "./admin-people-routes.js";

export type {
  AdminTelephoneBookingRouteServices,
  IAdminTelephoneBookingApplicationService,
} from "./admin-telephone-booking-routes.js";

export type {
  AdminLiveBiddingRateLimitError,
  AdminOperationsRouteServices,
  AdminPlacePaddleBidResult,
  ClerkPaddleBidHttpResult,
  IAdminDomainEventQueryService,
  IAdminEmailApplicationService,
  IAdminLegalEntityBrowseQueryService,
  IAdminLiveBiddingApplicationService,
  IAdminOnboardingIssuesQueryService,
  IAdminOpsReadService,
  IAdminRequestLifecycleService,
  IAdminReviewTaskQueryService,
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

export type {
  AdminDetailBoardRouteServices,
  IAdminLotDetailBoardService,
  IAdminSaleDetailBoardService,
} from "./admin-detail-board-routes.js";

export type {
  AdminMarketingEventsReplayBody,
  AdminSatelliteRouteServices,
  IAdminJobQueuesApplicationService,
  IAdminMarketingEventsApplicationService,
  IAdminOnsiteEventsApplicationService,
} from "./admin-satellite-routes.js";

import type { AdminCatalogRouteServices } from "./admin-catalog-routes.js";
import type { AdminComplianceRouteServices } from "./admin-compliance-routes.js";
import type { AdminDetailBoardRouteServices } from "./admin-detail-board-routes.js";
import type {
  AdminFinanceRouteServices,
  IAdminCatalogListSummariesQueryService,
  IAdminKpiTrendsQueryService,
  IAdminNavCountsQueryService,
} from "./admin-finance-routes.js";
import type { AdminOperationsRouteServices } from "./admin-operations-routes.js";
import type { AdminPeopleRouteServices } from "./admin-people-routes.js";
import type { AdminSatelliteRouteServices } from "./admin-satellite-routes.js";

export type AdminMetricsQueryServices = {
  navCounts: IAdminNavCountsQueryService;
  kpiTrends: IAdminKpiTrendsQueryService;
  listSummaries: IAdminCatalogListSummariesQueryService;
};

export type { AdminRouteServicesCore } from "../../admin/create-admin-route-services.js";

export type AdminRouteServicesWithoutSatellites = AdminCatalogRouteServices &
  AdminFinanceRouteServices &
  AdminComplianceRouteServices &
  AdminPeopleRouteServices &
  AdminOperationsRouteServices &
  AdminDetailBoardRouteServices &
  AdminMetricsQueryServices;

export type AdminRouteServices = AdminRouteServicesWithoutSatellites & AdminSatelliteRouteServices;

export type {
  AdminAuditRoutesContainer,
  AdminCatalogBrowseRoutesContainer,
  AdminCatalogRoutesContainer,
  AdminCatalogSupportRoutesContainer,
  AdminComplianceRoutesContainer,
  AdminFinancePayoutRoutesContainer,
  AdminFinanceShellRoutesContainer,
  AdminLotsRoutesContainer,
  AdminOpsDashboardRoutesContainer,
  AdminOpsMetricsRoutesContainer,
  AdminOperationsSaleroomRoutesContainer,
  AdminPaymentsRoutesContainer,
  AdminPeopleImpersonationRoutesContainer,
  AdminPeopleUsersRoutesContainer,
  AdminSatelliteJobQueuesRoutesContainer,
  AdminSatelliteMarketingEventsRoutesContainer,
  AdminSatelliteOnsiteEventsRoutesContainer,
} from "./admin-route-container-slices.js";
