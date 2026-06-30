import "server-only";

import { getAdminLotList } from "@/lib/data/http/admin-lots.server";
import {
  type AdminPaymentRow,
  type AdminPayoutRow,
  parseAdminPaymentRow,
  parseAdminPayoutRow,
} from "@/lib/data/http/admin-parse.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import type { Lot, PaymentStatus, PayoutStatus } from "@auction/types";

export async function getAdminPaymentList(): Promise<AdminPaymentRow[]> {
  const res = await authedServerFetch("/payments");
  if (!res.ok) {
    throw new Error(`Failed to load payments: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminPaymentRow);
}

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

function parseAdminPaymentTableRow(raw: unknown): AdminPaymentTableRow {
  const o = raw as Record<string, unknown>;
  const base = parseAdminPaymentRow(raw);
  return {
    id: base.id,
    lotId: base.lotId,
    lotTitle: String(o.lotTitle ?? base.lotId),
    buyerId: base.buyerId,
    buyerLabel: o.buyerLabel == null ? null : String(o.buyerLabel),
    sellerId: base.sellerId,
    amount: base.amount,
    platformFee: base.platformFee,
    status: base.status,
    fulfilmentStatus: o.fulfilmentStatus == null ? null : String(o.fulfilmentStatus),
    xeroInvoiceNumber: base.xeroInvoiceNumber,
    xeroOnlineInvoiceUrl: base.xeroOnlineInvoiceUrl,
    xeroSyncStatus: base.xeroSyncStatus,
    xeroLastError: base.xeroLastError,
  };
}

function parseMoneyStat(value: unknown): number {
  const n = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

export async function getAdminPaymentsListPage(params: {
  limit: number;
  offset: number;
  status?: PaymentStatus;
  q?: string;
}): Promise<AdminPaymentsListPageResult> {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  const res = await authedServerFetch(`/admin/payments?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load payments: ${res.status}`);
  const body = (await res.json()) as {
    data?: unknown[];
    meta?: {
      total?: number;
      limit?: number;
      offset?: number;
      summary?: {
        totalVolume?: string;
        captured?: string;
        pending?: string;
        refunded?: string;
      };
    };
  };
  const rows = Array.isArray(body.data) ? body.data.map(parseAdminPaymentTableRow) : [];
  const meta = body.meta ?? {};
  const summaryRaw = meta.summary ?? {};
  return {
    rows,
    total: meta.total ?? rows.length,
    offset: meta.offset ?? params.offset,
    limit: meta.limit ?? params.limit,
    summary: {
      totalVolume: parseMoneyStat(summaryRaw.totalVolume),
      captured: parseMoneyStat(summaryRaw.captured),
      pending: parseMoneyStat(summaryRaw.pending),
      refunded: parseMoneyStat(summaryRaw.refunded),
    },
  };
}

export async function getAdminPaymentsForUser(userId: string): Promise<AdminPaymentRow[]> {
  const all = await getAdminPaymentList();
  return all.filter((p) => p.buyerId === userId);
}

export async function getAdminLotsWonByUser(userId: string, limit = 20): Promise<Lot[]> {
  return getAdminLotList({ winnerId: userId, limit, offset: 0 });
}

export async function getAdminPayoutList(
  params: {
    legalEntityId?: string;
    status?: PayoutStatus;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminPayoutRow[]> {
  const qs = new URLSearchParams();
  if (params.legalEntityId) qs.set("legalEntityId", params.legalEntityId);
  if (params.status) qs.set("status", params.status);
  qs.set("limit", String(Math.min(100, Math.max(1, params.limit ?? 50))));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/payouts?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load payouts: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminPayoutRow);
}

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

export async function getAdminXeroIntegrationStatus(): Promise<AdminXeroIntegrationStatus> {
  const res = await authedServerFetch("/admin/integrations/xero/status");
  if (!res.ok) {
    throw new Error(`Failed to load Xero status: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminXeroIntegrationStatus };
  return body.data;
}
