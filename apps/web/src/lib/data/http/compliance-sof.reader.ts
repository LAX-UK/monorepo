import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type AdminSourceOfFundsDetail,
  type AdminSourceOfFundsRow,
  type BuyerSourceOfFundsView,
  adminSourceOfFundsDetailSchema,
  adminSourceOfFundsRowSchema,
  buyerSourceOfFundsViewSchema,
} from "@/lib/data/http/compliance-sof.schema";
import { COMPLIANCE_QUEUE_LIST_LIMIT } from "@/lib/data/http/compliance.shared";
import { readDataEnvelope, readJsonBody, readNullableListEnvelope } from "@/lib/data/http/envelope";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { normalizeApiErrorMessage } from "@auction/validators";

function readApiError(body: unknown, fallback: string): string {
  const error = isIndexableObject(body) ? body.error : undefined;
  return normalizeApiErrorMessage(error, fallback);
}

export async function getBuyerSourceOfFundsView(): Promise<BuyerSourceOfFundsView | null> {
  const res = await authedServerFetch("/payments/me/source-of-funds");
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load source of funds status"));
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, buyerSourceOfFundsViewSchema, "GET /payments/me/source-of-funds");
}

export async function getAdminSourceOfFundsPending(
  limit = COMPLIANCE_QUEUE_LIST_LIMIT,
  offset = 0,
): Promise<AdminSourceOfFundsRow[]> {
  const page = await getAdminSourceOfFundsPage({ status: "pending", limit, offset });
  return page.rows;
}

export async function getAdminSourceOfFundsRejected(
  limit = 50,
  offset = 0,
): Promise<AdminSourceOfFundsRow[]> {
  const page = await getAdminSourceOfFundsPage({ status: "rejected", limit, offset });
  return page.rows;
}

export async function getAdminSourceOfFundsApproved(
  limit = 50,
  offset = 0,
): Promise<AdminSourceOfFundsRow[]> {
  const page = await getAdminSourceOfFundsPage({ status: "approved", limit, offset });
  return page.rows;
}

export async function getAdminSourceOfFundsPage(params: {
  status: "pending" | "rejected" | "approved";
  limit: number;
  offset: number;
}): Promise<{ rows: AdminSourceOfFundsRow[]; total: number }> {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    status: params.status,
  });
  const res = await authedServerFetch(`/admin/compliance/source-of-funds?${qs.toString()}`);
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load Source of Funds cases"));
  }
  const body = await readJsonBody(res);
  return readNullableListEnvelope(
    body,
    adminSourceOfFundsRowSchema,
    "GET /admin/compliance/source-of-funds",
  );
}

export async function getAdminSourceOfFundsDetail(
  caseId: string,
): Promise<AdminSourceOfFundsDetail | null> {
  const res = await authedServerFetch(
    `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}/detail`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load Source of Funds case detail"));
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminSourceOfFundsDetailSchema,
    `GET /admin/compliance/source-of-funds/${caseId}/detail`,
  );
}

export async function getAdminUserSourceOfFunds(userId: string): Promise<AdminSourceOfFundsRow[]> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(userId)}/source-of-funds`);
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load Source of Funds cases for user"));
  }
  const body = await readJsonBody(res);
  return readNullableListEnvelope(
    body,
    adminSourceOfFundsRowSchema,
    `GET /admin/users/${userId}/source-of-funds`,
  ).rows;
}
