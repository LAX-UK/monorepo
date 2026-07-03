import "server-only";

import { getAdminLotList } from "@/lib/data/http/admin-lots.reader";
import {
  adminPaymentRowsSchema,
  adminPayoutRowsSchema,
  adminXeroIntegrationStatusSchema,
  adminXeroOAuthConsentUrlSchema,
  parseAdminPaymentsListPageBody,
} from "@/lib/data/http/admin-payments.schema";
import type {
  AdminPaymentRow,
  AdminPaymentsListPageResult,
  AdminPayoutRow,
  AdminXeroIntegrationStatus,
  GetAdminPaymentsListPageParams,
} from "@/lib/data/http/admin-payments.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import type { Lot, PayoutStatus } from "@auction/types";

export async function getAdminPaymentList(): Promise<AdminPaymentRow[]> {
  const res = await authedServerFetch("/payments");
  if (!res.ok) {
    throw new Error(`Failed to load payments: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminPaymentRowsSchema, "GET /payments");
}

export async function getAdminPaymentsListPage(
  params: GetAdminPaymentsListPageParams,
): Promise<AdminPaymentsListPageResult> {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  const res = await authedServerFetch(`/admin/payments?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load payments: ${res.status}`);
  const body = await readJsonBody(res);
  return parseAdminPaymentsListPageBody(body, params);
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
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminPayoutRowsSchema, "GET /admin/payouts");
}

export async function getAdminXeroIntegrationStatus(): Promise<AdminXeroIntegrationStatus> {
  const res = await authedServerFetch("/admin/integrations/xero/status");
  if (!res.ok) {
    throw new Error(`Failed to load Xero status: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminXeroIntegrationStatusSchema,
    "GET /admin/integrations/xero/status",
  );
}

export async function getAdminXeroOAuthConsentUrl(): Promise<string | null> {
  const res = await authedServerFetch("/admin/integrations/xero/oauth/consent-url");
  if (!res.ok) return null;
  const body = await readJsonBody(res);
  const parsed = readDataEnvelope(
    body,
    adminXeroOAuthConsentUrlSchema,
    "GET /admin/integrations/xero/oauth/consent-url",
  );
  return parsed.url || null;
}
