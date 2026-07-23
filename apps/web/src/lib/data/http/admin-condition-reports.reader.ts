import "server-only";

import {
  type AdminConditionReportsPage,
  type AdminConditionReportsPageParams,
  buildAdminConditionReportsSearchParams,
  parseAdminConditionReportsPageBody,
} from "@/lib/data/http/admin-condition-reports.shared";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { normalizeApiErrorMessage } from "@auction/validators";

export type {
  AdminConditionReportListSummary,
  AdminConditionReportRequestRow,
  AdminConditionReportsPage,
  AdminConditionReportsPageParams,
} from "@/lib/data/http/admin-condition-reports.shared";

function readApiError(body: unknown, fallback: string): string {
  const error = isIndexableObject(body) ? body.error : undefined;
  return normalizeApiErrorMessage(error, fallback);
}

export async function getAdminConditionReportsPage(
  params: AdminConditionReportsPageParams,
): Promise<AdminConditionReportsPage> {
  const qs = buildAdminConditionReportsSearchParams(params);
  const res = await authedServerFetch(`/admin/condition-report-requests?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load condition report requests"));
  }
  const body = await readJsonBody(res);
  return parseAdminConditionReportsPageBody(body, params);
}
