import type { AdminPaymentRow, AdminPayoutRow } from "@/lib/data/http/admin-parse.server";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import type { PaymentStatus } from "@auction/types";
import type { AdminPaymentXeroFilter, LotFulfilmentStatus } from "@auction/validators";

/** One summary total's daily series, oldest first, in pence, with the totals of two equal windows. */
export type AdminPaymentsTrend = {
  dailyPence: number[];
  currentPence: number;
  priorPence: number;
};

/**
 * The matching payments created each day over the last `periodDays`, by where they are now: the
 * volume, and the captured, refunded and awaiting-capture parts of it.
 */
export type AdminPaymentsTrends = {
  periodDays: number;
  volume: AdminPaymentsTrend;
  captured: AdminPaymentsTrend;
  refunded: AdminPaymentsTrend;
  awaiting: AdminPaymentsTrend;
};

/** Totals over the payments that match the list's filters, in pounds. */
export type AdminPaymentsSummary = {
  totalVolume: number;
  captured: number;
  pending: number;
  refunded: number;
  /** Absent when the API sent none. */
  trends?: AdminPaymentsTrends | undefined;
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
