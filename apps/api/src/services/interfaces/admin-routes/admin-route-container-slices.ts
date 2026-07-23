import type { AdminRouteServices } from "./index.js";

type AdminRoutePick<K extends keyof AdminRouteServices> = {
  admin: Pick<AdminRouteServices, K | "requestLifecycle">;
};

/** Shared request lifecycle for platform admin routes. */
export type AdminRequestLifecycleSlice = Pick<AdminRouteServices, "requestLifecycle">;

export type AdminCatalogRoutesContainer = AdminRoutePick<"catalog">;

export type AdminLotsRoutesContainer = AdminRoutePick<"lots" | "reviewTasks">;

export type AdminCatalogBrowseRoutesContainer = AdminRoutePick<"catalog" | "legalEntityBrowse">;

export type AdminOpsMetricsRoutesContainer = AdminRoutePick<
  "ops" | "navCounts" | "kpiTrends" | "listSummaries" | "saleDetailBoard" | "lotDetailBoard"
>;

export type AdminOpsDashboardRoutesContainer = AdminRoutePick<
  "financeIssueSnapshot" | "onboardingIssues" | "stripeConnectRequirements"
>;

export type AdminPaymentsRoutesContainer = AdminRoutePick<"payments" | "manualReviewPayments">;

export type AdminFinanceDisputesRoutesContainer = AdminRoutePick<
  "domainEvents" | "disputeCases" | "payments"
>;

export type AdminComplianceRoutesContainer = AdminRoutePick<"aml" | "sourceOfFunds">;

export type AdminPeopleUsersRoutesContainer = AdminRoutePick<"users" | "aml" | "sourceOfFunds">;

export type AdminPeopleImpersonationRoutesContainer = AdminRoutePick<"impersonation">;

export type AdminOperationsSaleroomRoutesContainer = AdminRoutePick<
  "saleroom" | "saleroomCheckIn" | "liveBidding" | "display"
>;

export type AdminTelephoneBookingRoutesContainer = AdminRoutePick<"telephoneBookings">;

export type AdminCatalogSupportRoutesContainer = AdminRoutePick<
  "conditionReports" | "lotFulfilment" | "saleRegistrations" | "qrCodes" | "email"
>;

export type AdminAuditRoutesContainer = AdminRoutePick<"domainEvents">;

export type AdminFinanceShellRoutesContainer = AdminRoutePick<
  "domainEvents" | "disputeCases" | "payments" | "xero"
>;

export type AdminFinancePayoutRoutesContainer = Pick<
  import("../../../container.js").Container,
  "userSuspensionChecker"
> & {
  admin: Pick<AdminRouteServices, "payouts">;
};

export type AdminSatelliteJobQueuesRoutesContainer = AdminRoutePick<"jobQueues">;

export type AdminSatelliteMarketingEventsRoutesContainer = AdminRoutePick<"marketingEvents">;

export type AdminSatelliteOnsiteEventsRoutesContainer = AdminRoutePick<"onsiteEvents">;
