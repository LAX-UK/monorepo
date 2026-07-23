import "server-only";

import {
  type AdminLotFulfilmentPage,
  type AdminLotFulfilmentPageParams,
  buildAdminLotFulfilmentSearchParams,
  parseAdminLotFulfilmentPageBody,
} from "@/lib/data/http/admin-lot-fulfilment.shared";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { normalizeApiErrorMessage } from "@auction/validators";

export type {
  AdminLotFulfilmentListRow,
  AdminLotFulfilmentListSummary,
  AdminLotFulfilmentPage,
  AdminLotFulfilmentPageParams,
} from "@/lib/data/http/admin-lot-fulfilment.shared";

function readApiError(body: unknown, fallback: string): string {
  const error = isIndexableObject(body) ? body.error : undefined;
  return normalizeApiErrorMessage(error, fallback);
}

export async function getAdminLotFulfilmentPage(
  params: AdminLotFulfilmentPageParams,
): Promise<AdminLotFulfilmentPage> {
  const qs = buildAdminLotFulfilmentSearchParams(params);
  const res = await authedServerFetch(`/admin/lot-fulfilment?${qs.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 401) {
    throw new Error("forbidden");
  }
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load lot fulfilment queue"));
  }
  const body = await readJsonBody(res);
  return parseAdminLotFulfilmentPageBody(body, params);
}
