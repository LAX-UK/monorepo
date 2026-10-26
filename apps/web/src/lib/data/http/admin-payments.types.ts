import type { AdminPaymentRow, AdminPayoutRow } from "@/lib/data/http/admin-parse.server";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import type { PaymentStatus } from "@auction/types";
import type { AdminPaymentXeroFilter, LotFulfilmentStatus } from "@auction/validators";

/** Volume of the matching payments created each day, with the totals of two equal windows. */
export type AdminPaymentsVolumeTrend = {
  periodDays: number;
  /** One value per day, oldest first, in pence. */
  dailyPence: number[];
  currentPence: number;
  priorPence: number;
};

/** Totals over the payments that match the list's filters, in pounds. */
export type AdminPaymentsSummary = {
  totalVolume: number;
  captured: number;
  pending: number;
  refunded: number;
  /** Absent when the API sent none. */
  volumeTrend?: AdminPaymentsVolumeTrend | undefined;
};

export type AdminPaymentsListPageResult = {
  rows: AdminPaymentTableRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminPaymentsSummary;
};

export type AdminXeroConnectionHealth = "healthy" | "degraded" | "disconnected";

export type AdminXeroIntegrationStatus = {
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
  health: AdminXeroConnectionHealth;
  connectionStatus: "healthy" | "needs_reauth" | null;
  lastRefreshError: string | null;
  orgShortCode: string | null;
  orgBaseCurrency: string | null;
};

export type GetAdminPaymentsListPageParams = {
  limit: number;
  offset: number;
  status?: PaymentStatus;
  q?: string;
  /** Lot fulfilment statuses; any of them matches. */
  fulfilment?: readonly LotFulfilmentStatus[];
  xero?: AdminPaymentXeroFilter;
};

export type { AdminPaymentRow, AdminPaymentTableRow, AdminPayoutRow };
