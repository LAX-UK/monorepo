import "server-only";

import {
  adminLegalEntityDocumentsSchema,
  adminLegalEntitySchema,
  adminStripeConnectRequirementRowsSchema,
} from "@/lib/data/http/admin-legal-entities.schema";
import {
  type AdminLegalEntitiesPage,
  type AdminLegalEntitiesPageParams,
  buildAdminLegalEntitiesSearchParams,
  parseAdminLegalEntitiesPageBody,
} from "@/lib/data/http/admin-legal-entities.shared";
import type {
  AdminLegalEntityDocument,
  AdminLegalEntityListResult,
  AdminLegalEntityPickerRow,
  AdminStripeConnectRequirementRow,
} from "@/lib/data/http/admin-legal-entities.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { LegalEntity, LegalEntityKind, LegalEntityStatus } from "@auction/types";
import { normalizeApiErrorMessage } from "@auction/validators";

export type {
  AdminLegalEntitiesPage,
  AdminLegalEntitiesPageParams,
  AdminLegalEntityListRow,
  AdminLegalEntityListSummary,
} from "@/lib/data/http/admin-legal-entities.shared";

function readApiError(body: unknown, fallback: string): string {
  const error = isIndexableObject(body) ? body.error : undefined;
  return normalizeApiErrorMessage(error, fallback);
}

export async function getAdminLegalEntitiesWithStripeConnectRequirements(): Promise<
  AdminStripeConnectRequirementRow[]
> {
  const res = await authedServerFetch("/admin/legal-entities/stripe-connect-requirements");
  if (!res.ok) {
    throw new Error(`Failed to load legal entities with Stripe requirements: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminStripeConnectRequirementRowsSchema,
    "GET /admin/legal-entities/stripe-connect-requirements",
  );
}

export async function getAdminLegalEntitiesPage(
  params: AdminLegalEntitiesPageParams,
): Promise<AdminLegalEntitiesPage> {
  const qs = buildAdminLegalEntitiesSearchParams(params);
  const res = await authedServerFetch(`/admin/legal-entities/browse?${qs.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 401) {
    throw new Error("forbidden");
  }
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load legal entities"));
  }
  const body = await readJsonBody(res);
  return parseAdminLegalEntitiesPageBody(body, params);
}

/** @deprecated Prefer getAdminLegalEntitiesPage for authoritative summaries. */
export async function getAdminLegalEntityList(params: {
  q?: string;
  status?: LegalEntityStatus;
  kind?: LegalEntityKind;
  stripeDue?: boolean;
  createdByUserId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLegalEntityListResult> {
  const page = await getAdminLegalEntitiesPage({
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.stripeDue ? { stripeDue: true } : {}),
    ...(params.createdByUserId ? { createdByUserId: params.createdByUserId } : {}),
  });
  return { rows: page.rows, total: page.total };
}

export async function searchAdminLegalEntitiesForPicker(params: {
  q?: string;
  createdByUserId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLegalEntityPickerRow[]> {
  const result = await getAdminLegalEntityList({
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(params.createdByUserId ? { createdByUserId: params.createdByUserId } : {}),
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  });
  return result.rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    status: row.status,
  }));
}

export async function getAdminLegalEntityById(id: string): Promise<LegalEntity | null> {
  const res = await authedServerFetch(`/admin/legal-entities/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load legal entity: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminLegalEntitySchema, `GET /admin/legal-entities/${id}`);
}

export async function getAdminLegalEntityDocuments(
  id: string,
): Promise<AdminLegalEntityDocument[]> {
  const res = await authedServerFetch(`/admin/legal-entities/${encodeURIComponent(id)}/documents`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Failed to load legal entity documents: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminLegalEntityDocumentsSchema,
    `GET /admin/legal-entities/${id}/documents`,
  );
}
