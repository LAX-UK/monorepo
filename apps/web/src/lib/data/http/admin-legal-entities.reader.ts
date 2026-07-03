import "server-only";

import {
  adminLegalEntityBrowsePayloadSchema,
  adminLegalEntityDocumentsSchema,
  adminLegalEntitySchema,
  adminStripeConnectRequirementRowsSchema,
} from "@/lib/data/http/admin-legal-entities.schema";
import type {
  AdminLegalEntityDocument,
  AdminLegalEntityListResult,
  AdminLegalEntityPickerRow,
  AdminStripeConnectRequirementRow,
} from "@/lib/data/http/admin-legal-entities.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import type { LegalEntity, LegalEntityKind, LegalEntityStatus } from "@auction/types";

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

export async function getAdminLegalEntityList(params: {
  q?: string;
  status?: LegalEntityStatus;
  kind?: LegalEntityKind;
  stripeDue?: boolean;
  createdByUserId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLegalEntityListResult> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.status) qs.set("status", params.status);
  if (params.kind) qs.set("kind", params.kind);
  if (params.stripeDue) qs.set("stripeDue", "1");
  if (params.createdByUserId) qs.set("createdByUserId", params.createdByUserId);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/legal-entities/browse?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load legal entities: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminLegalEntityBrowsePayloadSchema,
    "GET /admin/legal-entities/browse",
  );
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
