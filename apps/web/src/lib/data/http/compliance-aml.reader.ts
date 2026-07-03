import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type AdminAmlScreeningRow,
  adminAmlScreeningRowSchema,
} from "@/lib/data/http/compliance-aml.schema";
import { COMPLIANCE_QUEUE_LIST_LIMIT } from "@/lib/data/http/compliance.shared";
import { readJsonBody, readNullableListEnvelope } from "@/lib/data/http/envelope";
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

export async function getAdminAmlScreeningsPage(params: {
  limit: number;
  offset: number;
}): Promise<{ rows: AdminAmlScreeningRow[]; total: number }> {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  const res = await authedServerFetch(`/admin/compliance/aml/screenings?${qs.toString()}`);
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load AML screenings"));
  }
  const body = await readJsonBody(res);
  return readNullableListEnvelope(
    body,
    adminAmlScreeningRowSchema,
    "GET /admin/compliance/aml/screenings",
  );
}
