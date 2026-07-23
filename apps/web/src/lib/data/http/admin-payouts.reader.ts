import "server-only";

import {
  type AdminPayoutsPage,
  type AdminPayoutsPageParams,
  type AdminSettlementPreview,
  buildAdminPayoutsSearchParams,
  parseAdminPayoutsPageBody,
  parseAdminSettlementPreviewBody,
} from "@/lib/data/http/admin-payouts.shared";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";

export type {
  AdminPayoutListSummary,
  AdminPayoutsPage,
  AdminPayoutsPageParams,
  AdminSettlementPreview,
} from "@/lib/data/http/admin-payouts.shared";

/** Server-side paginated payouts list with filtered global summary. */
export async function getAdminPayoutsPage(
  params: AdminPayoutsPageParams,
): Promise<AdminPayoutsPage> {
  const qs = buildAdminPayoutsSearchParams(params);
  const res = await authedServerFetch(`/admin/payouts?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load payouts: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return parseAdminPayoutsPageBody(body, params);
}

/** Preview pending settlement for one legal entity before running settlement. */
export async function getAdminSettlementPreview(
  legalEntityId: string,
): Promise<AdminSettlementPreview> {
  const qs = new URLSearchParams({ legalEntityId });
  const res = await authedServerFetch(`/admin/payouts/settlement-preview?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load settlement preview: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return parseAdminSettlementPreviewBody(body);
}
