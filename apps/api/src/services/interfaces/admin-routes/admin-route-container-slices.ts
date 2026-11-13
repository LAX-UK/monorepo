import type {
  AdminEnquiryRouteServices,
  AdminIntegrationRouteServices,
  AdminStaffSecurityRouteServices,
} from "./admin-satellite-routes.js";
import type { AdminRouteServices } from "./index.js";

type AdminRoutePick<K extends keyof AdminRouteServices> = {
  admin: Pick<AdminRouteServices, K | "requestLifecycle">;
};

/** Shared request lifecycle for platform admin routes. */
export type AdminRequestLifecycleSlice = Pick<AdminRouteServices, "requestLifecycle">;

export type AdminCatalogRoutesContainer = AdminRoutePick<"catalog">;

export type AdminLotsRoutesContainer = AdminRoutePick<"lots" | "reviewTasks">;

export type AdminCollectionSettingsRoutesContainer = {
  admin: Pick<AdminIntegrationRouteServices, "collectionSettings">;
};

export type AdminCollectionDeskRoutesContainer = {
  admin: Pick<AdminIntegrationRouteServices, "collectionDesk">;
};

export type AdminInventoryRoutesContainer = {
  admin: Pick<AdminIntegrationRouteServices, "inventoryMoves">;
};

export type AdminCatalogBrowseRoutesContainer = AdminRoutePick<"catalog" | "legalEntityBrowse">;

export type AdminOpsMetricsRoutesContainer = AdminRoutePick<
  | "ops"
  | "navCounts"
  | "kpiTrends"
  | "listSummaries"
  | "saleDetailBoard"
  | "lotDetailBoard"
  | "workItems"
>;

export type AdminOpsDashboardRoutesContainer = AdminRoutePick<
  "financeIssueSnapshot" | "onboardingIssues" | "stripeConnectRequirements"
>;

export type AdminPaymentsRoutesContainer = AdminRoutePick<"payments" | "manualReviewPayments">;

export type AdminDisputeDeskRoutesContainer = AdminRoutePick<"disputeDesk">;

export type AdminAccountingRoutesContainer = AdminRoutePick<"accountingQueue">;

export type AdminFinanceDisputesRoutesContainer = AdminRoutePick<
  "domainEvents" | "disputeCases" | "payments"
>;

export type AdminComplianceRoutesContainer = AdminRoutePick<"aml" | "sourceOfFunds">;

export type AdminPeopleUsersRoutesContainer = AdminRoutePick<"users" | "aml" | "sourceOfFunds">;

export type AdminPeopleImpersonationRoutesContainer = AdminRoutePick<"impersonation">;

export type AdminOperationsSaleroomRoutesContainer = AdminRoutePick<
  "saleroom" | "saleroomCheckIn" | "liveBidding" | "display" | "saleReadiness"
>;

export type AdminTelephoneBookingRoutesContainer = AdminRoutePick<"telephoneBookings">;

export type AdminCatalogSupportRoutesContainer = AdminRoutePick<
  "conditionReports" | "lotFulfilment" | "saleRegistrations" | "qrCodes"
> & { admin: Pick<AdminIntegrationRouteServices, "deliveryQuotes"> };

export type AdminEmailRoutesContainer = AdminRoutePick<
  "email" | "emailDelivery" | "emailBlockLift"
>;

export type AdminAuditRoutesContainer = AdminRoutePick<"domainEvents" | "auditLog">;

export type AdminFinanceShellRoutesContainer = AdminRoutePick<
  "domainEvents" | "disputeCases" | "payments" | "xero"
>;

export type AdminFinancePayoutRoutesContainer = Pick<
  import("../../../container.js").Container,
  "userSuspensionChecker"
> & {
  admin: Pick<AdminRouteServices, "payouts"> &
    Pick<AdminStaffSecurityRouteServices, "stepUp" | "idempotencyStore">;
};

export type AdminEnquiryRoutesContainer = { admin: AdminEnquiryRouteServices };

export type AdminSatelliteJobQueuesRoutesContainer = AdminRoutePick<"jobQueues">;

export type AdminSatelliteFailedJobsRoutesContainer = AdminRoutePick<"failedJobs">;

export type AdminSatelliteMarketingEventsRoutesContainer = AdminRoutePick<"marketingEvents">;

export type AdminSatelliteOnsiteEventsRoutesContainer = AdminRoutePick<"onsiteEvents">;
