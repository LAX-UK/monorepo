import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type AdminSourceOfFundsDetail,
  type AdminSourceOfFundsRow,
  type BuyerSourceOfFundsView,
  buyerSofViewFromJson,
  sofDetailFromJson,
  sofFromJson,
} from "@/lib/data/http/compliance-sof.mapper";
import { COMPLIANCE_QUEUE_LIST_LIMIT } from "@/lib/data/http/compliance.shared";
import { normalizeApiErrorMessage } from "@auction/validators";

export async function getBuyerSourceOfFundsView(): Promise<BuyerSourceOfFundsView | null> {
  const res = await authedServerFetch("/payments/me/source-of-funds");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load source of funds status",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown };
  return buyerSofViewFromJson(json.data);
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
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load Source of Funds cases",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown; meta?: { total?: number } };
  const rows = Array.isArray(json.data) ? json.data : [];
  return {
    rows: rows.map(sofFromJson).filter((r): r is AdminSourceOfFundsRow => r != null),
    total: json.meta?.total ?? rows.length,
  };
}

export async function getAdminSourceOfFundsDetail(
  caseId: string,
): Promise<AdminSourceOfFundsDetail | null> {
  const res = await authedServerFetch(
    `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}/detail`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load Source of Funds case detail",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown };
  return sofDetailFromJson(json.data);
}

export async function getAdminUserSourceOfFunds(userId: string): Promise<AdminSourceOfFundsRow[]> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(userId)}/source-of-funds`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load Source of Funds cases for user",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map(sofFromJson).filter((r): r is AdminSourceOfFundsRow => r != null);
}
