import type { FinanceIssueSnapshot, StripeConnectRequirementEntityRow } from "@auction/persistence";
import type { Result } from "neverthrow";
import type { AuthzError } from "../../../lib/errors.js";
import type { AdminNavCounts } from "../../admin/admin-nav-counts.service.js";
import type { AdminKpiPeriodDays, AdminKpiTrendBundle } from "../admin-kpi-trend.js";
import type { ListPaymentsAdminTableFilter } from "../payment-write.js";
import type { IStripeConnectService } from "../stripe-connect.js";

export interface IAdminPaymentsApplicationService {
  releaseManualReviewForCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError>>;
  refundManualReviewPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError>>;
  syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>>;
  listPage(
    filter: ListPaymentsAdminTableFilter,
  ): Promise<import("../../admin/admin-payment-list-query.service.js").AdminPaymentListPage>;
}

export type IAdminStripeConnectApplicationService = IStripeConnectService & {
  readonly webOrigin: string | undefined;
};

export type XeroConnectionHealth = "healthy" | "degraded" | "disconnected";

export type XeroStatusPayload = {
  connected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
  connectedAt: string | null;
  updatedAt: string | null;
  connectedBy: { id: string; name: string; email: string } | null;
  scopes: string | null;
  webhookConfigured: boolean;
  webhookUrl: string | null;
  recentWebhookErrors: number;
  syncErrorCount: number;
  health: XeroConnectionHealth;
  connectionStatus: "healthy" | "needs_reauth" | null;
  lastRefreshError: string | null;
  orgShortCode: string | null;
  orgBaseCurrency: string | null;
};

export interface IXeroAdminApplicationService {
  getStatusPayload(): Promise<XeroStatusPayload>;
  buildConsentUrl(
    userId: string,
  ): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  completeOAuth(input: {
    userId: string;
    state: string;
    callbackFullUrl: string;
  }): Promise<{ ok: true } | { ok: false; message: string }>;
  disconnect(): Promise<{ ok: true } | { ok: false; error: string }>;
}

export type { AdminNavCounts } from "../../admin/admin-nav-counts.service.js";
export type { AdminKpiPeriodDays, AdminKpiTrendBundle } from "../admin-kpi-trend.js";

export interface IAdminDashboardMetricsService {
  getNavCounts(): Promise<AdminNavCounts>;
  getLotsTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
  getPaymentsTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
  getSalesTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
  getPayoutsTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
}

export type { FinanceIssueSnapshot, StripeConnectRequirementEntityRow };

export interface IAdminFinanceIssueSnapshotQueryService {
  getFinanceIssueSnapshot(): Promise<FinanceIssueSnapshot>;
  listStripeConnectRequirementEntities(): Promise<StripeConnectRequirementEntityRow[]>;
}

export interface IAdminManualReviewPaymentQueryService {
  listManualReviewPayments(): Promise<
    import("../../../admin/admin-route-dtos.js").AdminManualReviewPaymentRow[]
  >;
  countManualReviewPayments(): Promise<number>;
}

export interface IAdminFinanceDashboardQueryService
  extends IAdminFinanceIssueSnapshotQueryService,
    IAdminManualReviewPaymentQueryService {}

export type AdminFinanceRouteServices = {
  payments: IAdminPaymentsApplicationService;
  stripeConnect: IAdminStripeConnectApplicationService;
  xero: IXeroAdminApplicationService;
  dashboardMetrics: IAdminDashboardMetricsService;
};
