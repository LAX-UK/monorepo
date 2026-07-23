import { adminUserRowSchema } from "@/lib/data/http/admin-users.schema";
import type { AdminUserRow, GetAdminUserListParams } from "@/lib/data/http/admin-users.types";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { z } from "zod";

export type AdminUserListSummary = {
  total: number;
  active: number;
  suspended: number;
  emailVerified: number;
  kycVerified: number;
  byStaffRole: Record<string, number>;
};

export type AdminUserPageParams = GetAdminUserListParams;

export type AdminUserPage = {
  rows: AdminUserRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminUserListSummary;
  hasNextPage: boolean;
};

export const EMPTY_ADMIN_USER_LIST_SUMMARY: AdminUserListSummary = {
  total: 0,
  active: 0,
  suspended: 0,
  emailVerified: 0,
  kycVerified: 0,
  byStaffRole: {},
};

const summarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  active: z.coerce.number().int().nonnegative(),
  suspended: z.coerce.number().int().nonnegative(),
  emailVerified: z.coerce.number().int().nonnegative(),
  kycVerified: z.coerce.number().int().nonnegative(),
  byStaffRole: z.record(z.coerce.string(), z.coerce.number().int().nonnegative()).default({}),
});

function parseSummary(value: unknown): AdminUserListSummary {
  const parsed = summarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid users list summary in API response");
  }
  return parsed.data;
}

export function buildAdminUserSearchParams(params: AdminUserPageParams): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  if (params.q) qs.set("q", params.q);
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
  return qs;
}

export function parseAdminUserPageBody(body: unknown, params: AdminUserPageParams): AdminUserPage {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data)
    ? envelope.data.map((row) => adminUserRowSchema.parse(row))
    : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summary = parseSummary(meta.summary);
  const total = Number(meta.total);
  if (!Number.isFinite(total)) {
    throw new Error("Invalid users list total in API response");
  }
  const limit = Number(meta.limit ?? params.limit ?? 25);
  const offset = Number(meta.offset ?? params.offset ?? 0);
  return {
    rows,
    total,
    offset,
    limit,
    summary,
    hasNextPage: offset + rows.length < total,
  };
}
