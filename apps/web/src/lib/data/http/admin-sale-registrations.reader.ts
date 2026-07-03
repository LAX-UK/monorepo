import "server-only";

import {
  adminCheckInCandidateItemsEnvelopeSchema,
  adminSaleDetailRowSchemaExport,
  adminSaleListRowsSchema,
  adminSaleRegistrationItemsEnvelopeSchema,
} from "@/lib/data/http/admin-sale-registrations.schema";
import type {
  AdminCheckInCandidate,
  AdminSaleDetailRow,
  AdminSaleListRow,
  AdminSaleRegistrationRow,
} from "@/lib/data/http/admin-sale-registrations.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import type { Sale } from "@auction/types";

export async function getAdminSalesList(
  params: {
    status?: Sale["status"];
    q?: string;
    deliveryMode?: Sale["deliveryMode"];
    settlementStatus?: "settled" | "unsettled";
    categoryId?: string;
    limit?: number;
    offset?: number;
    sort?: "createdDesc" | "startAsc";
    needsSetup?: boolean;
  } = {},
): Promise<AdminSaleListRow[]> {
  const qs = new URLSearchParams();
  // GET /sales rejects limit > 100 (listSalesQuerySchema.max(100)).
  qs.set("limit", String(Math.min(params.limit ?? 50, 100)));
  qs.set("offset", String(params.offset ?? 0));
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.deliveryMode) qs.set("deliveryMode", params.deliveryMode);
  if (params.settlementStatus) qs.set("settlementStatus", params.settlementStatus);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.sort) qs.set("sort", params.sort);
  if (params.needsSetup) qs.set("needsSetup", "1");
  const res = await authedServerFetch(`/sales?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load sales: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminSaleListRowsSchema, "GET /sales");
}

export async function getAdminSaleById(id: string): Promise<AdminSaleDetailRow | null> {
  const res = await authedServerFetch(`/sales/${encodeURIComponent(id)}/catalog-admin`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminSaleDetailRowSchemaExport, `GET /sales/${id}/catalog-admin`);
}

export async function getAdminSaleRegistrations(
  saleId: string,
  params?: { status?: AdminSaleRegistrationRow["status"] },
): Promise<AdminSaleRegistrationRow[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/registrations${suffix}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load sale registrations: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminSaleRegistrationItemsEnvelopeSchema,
    `GET /admin/sales/${saleId}/registrations`,
  );
}

export async function getAdminSaleroomCheckInCandidates(
  saleId: string,
  q: string,
): Promise<AdminCheckInCandidate[]> {
  const qs = new URLSearchParams({ q });
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/registrations/check-in-candidates?${qs.toString()}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error ?? "Failed to load check-in candidates");
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminCheckInCandidateItemsEnvelopeSchema,
    `GET /admin/sales/${saleId}/registrations/check-in-candidates`,
  );
}
