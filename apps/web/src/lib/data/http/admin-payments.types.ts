import type { AdminPaymentRow, AdminPayoutRow } from "@/lib/data/http/admin-parse.server";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import type { PaymentStatus } from "@auction/types";

export type AdminPaymentsListPageResult = {
  rows: AdminPaymentTableRow[];
  total: number;
  offset: number;
  limit: number;
  summary: {
    totalVolume: number;
    captured: number;
    pending: number;
    refunded: number;
  };
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
};

export type { AdminPaymentRow, AdminPaymentTableRow, AdminPayoutRow };
