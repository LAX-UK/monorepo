import "server-only";

import {
  getAdminLegalEntityById,
  searchAdminLegalEntitiesForPicker,
} from "@/lib/data/http/admin-legal-entities.reader";
import {
  adminKycSessionRowsSchema,
  adminUserActivityEntriesSchema,
  adminUserBidsResultSchema,
  adminUserDetailRowSchema,
  adminUserLookupRowsSchema,
} from "@/lib/data/http/admin-users.schema";
import {
  type AdminUserPage,
  buildAdminUserSearchParams,
  parseAdminUserPageBody,
} from "@/lib/data/http/admin-users.shared";
import type {
  AdminKycSessionRow,
  AdminUserActivityEntry,
  AdminUserBidRow,
  AdminUserDetailPayload,
  AdminUserLookupRow,
  GetAdminUserListParams,
} from "@/lib/data/http/admin-users.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type AdminAmlScreeningRow, screeningFromJson } from "@/lib/data/http/compliance.server";
import { readDataEnvelope, readJsonBody, unwrapEnvelopeData } from "@/lib/data/http/envelope";

export type {
  AdminUserListSummary,
  AdminUserPage,
  AdminUserPageParams,
} from "@/lib/data/http/admin-users.shared";
import type { LegalEntity } from "@auction/types";

export async function getAdminLegalEntitiesForUser(userId: string): Promise<LegalEntity[]> {
  const pickerRows = await searchAdminLegalEntitiesForPicker({
    createdByUserId: userId,
    limit: 50,
    offset: 0,
  });
  const entities = await Promise.all(pickerRows.map((row) => getAdminLegalEntityById(row.id)));
  return entities.filter((e): e is LegalEntity => e != null);
}

export async function getAdminUserList(params: GetAdminUserListParams): Promise<AdminUserPage> {
  const qs = buildAdminUserSearchParams(params);
  const res = await authedServerFetch(`/admin/users?${qs.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 401) {
    throw new Error("forbidden");
  }
  if (!res.ok) {
    throw new Error(`Failed to load users: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return parseAdminUserPageBody(body, params);
}

export async function getAdminUserKycSessions(userId: string): Promise<AdminKycSessionRow[]> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(userId)}/kyc-sessions`);
  if (!res.ok) {
    throw new Error(`Failed to load KYC sessions: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminKycSessionRowsSchema,
    `GET /admin/users/${userId}/kyc-sessions`,
  );
}

export async function getAdminUserAmlScreenings(userId: string): Promise<AdminAmlScreeningRow[]> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(userId)}/aml-screenings`);
  if (!res.ok) {
    throw new Error(`Failed to load AML screenings: ${res.status}`);
  }
  const body = await readJsonBody(res);
  const rows = unwrapEnvelopeData(body);
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => screeningFromJson(row))
    .filter((r): r is AdminAmlScreeningRow => r != null);
}

export async function getAdminUserById(id: string): Promise<AdminUserDetailPayload | null> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load user: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminUserDetailRowSchema, `GET /admin/users/${id}`);
}

export async function getAdminUsersByIds(ids: string[]): Promise<AdminUserLookupRow[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const qs = new URLSearchParams({ ids: unique.join(",") });
  const res = await authedServerFetch(`/admin/users/lookup?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminUserLookupRowsSchema, "GET /admin/users/lookup");
}

export async function getAdminUserBids(
  userId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<{ rows: AdminUserBidRow[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(
    `/admin/users/${encodeURIComponent(userId)}/bids?${qs.toString()}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load user bids: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminUserBidsResultSchema, `GET /admin/users/${userId}/bids`);
}

export async function getAdminUserActivity(
  userId: string,
  limit = 20,
): Promise<AdminUserActivityEntry[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  const res = await authedServerFetch(
    `/admin/users/${encodeURIComponent(userId)}/activity?${qs.toString()}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load user activity: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminUserActivityEntriesSchema,
    `GET /admin/users/${userId}/activity`,
  );
}
