import "server-only";

import {
  getAdminLegalEntityById,
  searchAdminLegalEntitiesForPicker,
} from "@/lib/data/http/admin-legal-entities.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type AdminAmlScreeningRow, screeningFromJson } from "@/lib/data/http/compliance.server";
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

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  staffRole: string | null;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  image: string | null;
  mobile: string | null;
  mobileCountry: string | null;
  emailVerified: boolean;
  emailStatus: string;
  signupPersona: string | null;
  twoFactorEnabled: boolean;
  kycStatus: string;
  kycVerifiedAt: string | null;
  kycRetryCount: number;
  deletionRequestedAt: string | null;
};

export type GetAdminUserListParams = {
  q?: string;
  limit?: number;
  offset?: number;
  role?: string;
  staffRole?: string;
  suspendedOnly?: boolean;
  accountStatus?: "active" | "suspended";
  emailVerified?: boolean;
  emailStatus?: "ok" | "bounced" | "complained";
  kycStatus?: string;
  kycStatuses?: string[];
  persona?: "individual" | "organisation" | "none";
  twoFactorEnabled?: boolean;
  deletionRequestedOnly?: boolean;
  hasMobile?: boolean;
  createdFrom?: string;
  createdTo?: string;
  kycVerifiedFrom?: string;
  kycVerifiedTo?: string;
  lastActiveFrom?: string;
  lastActiveTo?: string;
  sort?: string;
};

export async function getAdminUserList(
  params: GetAdminUserListParams,
): Promise<{ rows: AdminUserRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  if (params.role) qs.set("role", params.role);
  if (params.staffRole) qs.set("staffRole", params.staffRole);
  if (params.accountStatus) qs.set("status", params.accountStatus);
  else if (params.suspendedOnly) qs.set("suspended", "1");
  if (params.emailVerified === true) qs.set("emailVerified", "1");
  else if (params.emailVerified === false) qs.set("emailVerified", "0");
  if (params.emailStatus) qs.set("emailStatus", params.emailStatus);
  if (params.kycStatuses?.length) qs.set("kycStatuses", params.kycStatuses.join(","));
  else if (params.kycStatus) qs.set("kycStatus", params.kycStatus);
  if (params.persona) qs.set("persona", params.persona);
  if (params.twoFactorEnabled === true) qs.set("twoFactor", "1");
  else if (params.twoFactorEnabled === false) qs.set("twoFactor", "0");
  if (params.deletionRequestedOnly) qs.set("deletionRequested", "1");
  if (params.hasMobile === true) qs.set("hasMobile", "1");
  else if (params.hasMobile === false) qs.set("hasMobile", "0");
  if (params.createdFrom) qs.set("createdFrom", params.createdFrom);
  if (params.createdTo) qs.set("createdTo", params.createdTo);
  if (params.kycVerifiedFrom) qs.set("kycVerifiedFrom", params.kycVerifiedFrom);
  if (params.kycVerifiedTo) qs.set("kycVerifiedTo", params.kycVerifiedTo);
  if (params.lastActiveFrom) qs.set("lastActiveFrom", params.lastActiveFrom);
  if (params.lastActiveTo) qs.set("lastActiveTo", params.lastActiveTo);
  if (params.sort) qs.set("sort", params.sort);
  const res = await authedServerFetch(`/admin/users?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load users: ${res.status}`);
  }
  const json = (await res.json()) as { data: { rows: AdminUserRow[]; total: number } };
  return json.data;
}

export type AdminUserDetailPayload = AdminUserRow & {
  suspendedReason: string | null;
  dateOfBirth: string | null;
  emailStatusChangedAt: string | null;
  pendingNewEmail: string | null;
  emailChangeExpiresAt: string | null;
  currentKycSessionId: string | null;
  amlHoldStatus: string | null;
  amlHoldReason: string | null;
  amlHoldAt: string | null;
};

export type AdminKycSessionRow = {
  id: string;
  provider: string;
  providerSessionId: string;
  providerAttemptId: string | null;
  status: string;
  verifiedFirstName: string | null;
  verifiedLastName: string | null;
  verifiedDateOfBirth: string | null;
  verifiedIdNumberLast4: string | null;
  verifiedIdCountry: string | null;
  verifiedIdType: string | null;
  verifiedIdExpiry: string | null;
  verifiedGender: string | null;
  verifiedNationality: string | null;
  verifiedCitizenship: string | null;
  verifiedPlaceOfBirth: string | null;
  verifiedYearOfBirth: string | null;
  verifiedIdNumber: string | null;
  verifiedDocState: string | null;
  verifiedIdValidFrom: string | null;
  decisionRiskScore: string | null;
  decisionIpCountry: string | null;
  decisionStatus: string | null;
  decisionReasonCode: number | null;
  decisionReasonLabel: string | null;
  createdAt: string;
  decisionAt: string | null;
};

export async function getAdminUserKycSessions(userId: string): Promise<AdminKycSessionRow[]> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(userId)}/kyc-sessions`);
  if (!res.ok) {
    throw new Error(`Failed to load KYC sessions: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminKycSessionRow[] };
  return body.data;
}

export async function getAdminUserAmlScreenings(userId: string): Promise<AdminAmlScreeningRow[]> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(userId)}/aml-screenings`);
  if (!res.ok) {
    throw new Error(`Failed to load AML screenings: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data
    .map((row) => screeningFromJson(row))
    .filter((r): r is AdminAmlScreeningRow => r != null);
}

export async function getAdminUserById(id: string): Promise<AdminUserDetailPayload | null> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load user: ${res.status}`);
  const body = (await res.json()) as { data: AdminUserDetailPayload };
  return body.data;
}

export type AdminUserLookupRow = {
  id: string;
  name: string;
  email: string;
};

export async function getAdminUsersByIds(ids: string[]): Promise<AdminUserLookupRow[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const qs = new URLSearchParams({ ids: unique.join(",") });
  const res = await authedServerFetch(`/admin/users/lookup?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
  const body = (await res.json()) as {
    data: { id: string; name: string; email: string }[];
  };
  return body.data.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
  }));
}

export type AdminUserActivityEntry = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
};

export type AdminUserBidRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  saleId: string | null;
  saleTitle: string | null;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  placedVia: string | null;
  createdAt: Date;
};

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
  const body = (await res.json()) as {
    data: {
      rows: Array<Omit<AdminUserBidRow, "createdAt"> & { createdAt: string }>;
      total: number;
    };
  };
  return {
    total: body.data.total,
    rows: body.data.rows.map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt),
    })),
  };
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
  const body = (await res.json()) as { data: AdminUserActivityEntry[] };
  return body.data;
}
