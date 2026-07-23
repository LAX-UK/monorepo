import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance-aml.schema";
import { adminAmlScreeningRowSchema } from "@/lib/data/http/compliance-aml.schema";
import type { AdminAmlPageParams } from "@/lib/data/http/compliance-aml.shared";
import {
  buildAdminAmlSearchParams,
  parseAdminAmlPageBody,
} from "@/lib/data/http/compliance-aml.shared";
import { COMPLIANCE_QUEUE_LIST_LIMIT } from "@/lib/data/http/compliance.shared";
import { readJsonBody } from "@/lib/data/http/envelope";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { normalizeApiErrorMessage } from "@auction/validators";

function readApiError(body: unknown, fallback: string): string {
  const error = isIndexableObject(body) ? body.error : undefined;
  return normalizeApiErrorMessage(error, fallback);
}

export async function getAdminAmlScreeningsPending(
  limit = COMPLIANCE_QUEUE_LIST_LIMIT,
  offset = 0,
): Promise<AdminAmlScreeningRow[]> {
  const page = await getAdminAmlScreeningsPage({ limit, offset });
  return page.rows;
}

export async function getAdminAmlScreeningsPage(params: AdminAmlPageParams) {
  const qs = buildAdminAmlSearchParams(params);
  const res = await authedServerFetch(`/admin/compliance/aml/screenings?${qs.toString()}`);
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load AML screenings"));
  }
  const body = await readJsonBody(res);
  return parseAdminAmlPageBody(body, params);
}

export async function getAdminAmlScreeningById(
  screeningId: string,
): Promise<AdminAmlScreeningRow | null> {
  const res = await authedServerFetch(
    `/admin/compliance/aml/screenings/${encodeURIComponent(screeningId)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load AML screening"));
  }
  const body = await readJsonBody(res);
  const envelope = isIndexableObject(body) ? body : {};
  if (!envelope.data) return null;
  return adminAmlScreeningRowSchema.parse(envelope.data);
}
