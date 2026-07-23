import { firstString } from "@/lib/admin/admin-list-params";
import type { GetAdminUserListParams } from "@/lib/data/http/admin-users.types";
import { adminUserListSortEnum } from "@auction/validators";
import type { z } from "zod";

type AdminUserListSort = z.infer<typeof adminUserListSortEnum>;

const SORT_VALUES = adminUserListSortEnum.options;

export type UsersListFilters = {
  q?: string | undefined;
  role?: string | undefined;
  staffRole?: string | undefined;
  suspendedOnly?: boolean | undefined;
  accountStatus?: "active" | "suspended" | undefined;
  emailVerified?: boolean | undefined;
  kycStatus?: string | undefined;
  kycStatuses?: string[] | undefined;
  persona?: "individual" | "organisation" | "none" | undefined;
  twoFactorEnabled?: boolean | undefined;
  deletionRequestedOnly?: boolean | undefined;
  hasMobile?: boolean | undefined;
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
  kycVerifiedFrom?: string | undefined;
  kycVerifiedTo?: string | undefined;
  lastActiveFrom?: string | undefined;
  lastActiveTo?: string | undefined;
  sort?: AdminUserListSort | undefined;
};

function triState(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): boolean | undefined {
  const v = firstString(sp[key]);
  if (v === "1") return true;
  if (v === "0") return false;
  return undefined;
}

export function parseUsersListFilters(
  sp: Record<string, string | string[] | undefined>,
): UsersListFilters {
  const statusRaw = firstString(sp.status);
  const accountStatus = statusRaw === "active" || statusRaw === "suspended" ? statusRaw : undefined;

  const kycStatusesRaw = firstString(sp.kycStatuses);
  const kycStatuses = kycStatusesRaw
    ? kycStatusesRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const sortRaw = firstString(sp.sort);
  const sort =
    sortRaw && (SORT_VALUES as readonly string[]).includes(sortRaw)
      ? (sortRaw as AdminUserListSort)
      : undefined;

  const personaRaw = firstString(sp.persona);
  const persona =
    personaRaw === "individual" || personaRaw === "organisation" || personaRaw === "none"
      ? personaRaw
      : undefined;

  const out: UsersListFilters = {};
  const q = firstString(sp.q)?.trim();
  if (q) out.q = q;
  const role = firstString(sp.role);
  if (role) out.role = role;
  const staffRole = firstString(sp.staffRole);
  if (staffRole) out.staffRole = staffRole;
  if (firstString(sp.suspended) === "1") out.suspendedOnly = true;
  if (accountStatus) out.accountStatus = accountStatus;
  const emailVerified = triState(sp, "emailVerified");
  if (emailVerified !== undefined) out.emailVerified = emailVerified;
  const kycStatus = firstString(sp.kycStatus);
  if (kycStatuses?.length) out.kycStatuses = kycStatuses;
  else if (kycStatus) out.kycStatus = kycStatus;
  if (persona) out.persona = persona;
  const twoFactorEnabled = triState(sp, "twoFactor");
  if (twoFactorEnabled !== undefined) out.twoFactorEnabled = twoFactorEnabled;
  if (firstString(sp.deletionRequested) === "1") out.deletionRequestedOnly = true;
  const hasMobile = triState(sp, "hasMobile");
  if (hasMobile !== undefined) out.hasMobile = hasMobile;
  const createdFrom = firstString(sp.createdFrom);
  if (createdFrom) out.createdFrom = createdFrom;
  const createdTo = firstString(sp.createdTo);
  if (createdTo) out.createdTo = createdTo;
  const kycVerifiedFrom = firstString(sp.kycVerifiedFrom);
  if (kycVerifiedFrom) out.kycVerifiedFrom = kycVerifiedFrom;
  const kycVerifiedTo = firstString(sp.kycVerifiedTo);
  if (kycVerifiedTo) out.kycVerifiedTo = kycVerifiedTo;
  const lastActiveFrom = firstString(sp.lastActiveFrom);
  if (lastActiveFrom) out.lastActiveFrom = lastActiveFrom;
  const lastActiveTo = firstString(sp.lastActiveTo);
  if (lastActiveTo) out.lastActiveTo = lastActiveTo;
  if (sort) out.sort = sort;
  return out;
}

export function usersListFiltersToGetAdminUserListParams(
  filters: UsersListFilters,
  paging: { limit: number; offset: number },
): GetAdminUserListParams {
  return {
    limit: paging.limit,
    offset: paging.offset,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.staffRole ? { staffRole: filters.staffRole } : {}),
    ...(filters.accountStatus ? { accountStatus: filters.accountStatus } : {}),
    ...(filters.suspendedOnly ? { suspendedOnly: true } : {}),
    ...(filters.emailVerified !== undefined ? { emailVerified: filters.emailVerified } : {}),
    ...(filters.kycStatuses?.length ? { kycStatuses: filters.kycStatuses } : {}),
    ...(filters.kycStatus ? { kycStatus: filters.kycStatus } : {}),
    ...(filters.persona ? { persona: filters.persona } : {}),
    ...(filters.twoFactorEnabled !== undefined
      ? { twoFactorEnabled: filters.twoFactorEnabled }
      : {}),
    ...(filters.deletionRequestedOnly ? { deletionRequestedOnly: true } : {}),
    ...(filters.hasMobile !== undefined ? { hasMobile: filters.hasMobile } : {}),
    ...(filters.createdFrom ? { createdFrom: filters.createdFrom } : {}),
    ...(filters.createdTo ? { createdTo: filters.createdTo } : {}),
    ...(filters.kycVerifiedFrom ? { kycVerifiedFrom: filters.kycVerifiedFrom } : {}),
    ...(filters.kycVerifiedTo ? { kycVerifiedTo: filters.kycVerifiedTo } : {}),
    ...(filters.lastActiveFrom ? { lastActiveFrom: filters.lastActiveFrom } : {}),
    ...(filters.lastActiveTo ? { lastActiveTo: filters.lastActiveTo } : {}),
    ...(filters.sort ? { sort: filters.sort } : {}),
  };
}

export function usersListFiltersToApiParams(
  filters: UsersListFilters,
  paging: { limit: number; offset: number },
): Record<string, string> {
  const qs: Record<string, string> = {
    limit: String(paging.limit),
    offset: String(paging.offset),
  };

  if (filters.q) qs.q = filters.q;
  if (filters.role) qs.role = filters.role;
  if (filters.staffRole) qs.staffRole = filters.staffRole;
  if (filters.accountStatus) qs.status = filters.accountStatus;
  else if (filters.suspendedOnly) qs.suspended = "1";

  if (filters.emailVerified === true) qs.emailVerified = "1";
  else if (filters.emailVerified === false) qs.emailVerified = "0";

  if (filters.kycStatuses?.length) qs.kycStatuses = filters.kycStatuses.join(",");
  else if (filters.kycStatus) qs.kycStatus = filters.kycStatus;
  if (filters.persona) qs.persona = filters.persona;

  if (filters.twoFactorEnabled === true) qs.twoFactor = "1";
  else if (filters.twoFactorEnabled === false) qs.twoFactor = "0";

  if (filters.deletionRequestedOnly) qs.deletionRequested = "1";
  if (filters.hasMobile === true) qs.hasMobile = "1";
  else if (filters.hasMobile === false) qs.hasMobile = "0";

  if (filters.createdFrom) qs.createdFrom = filters.createdFrom;
  if (filters.createdTo) qs.createdTo = filters.createdTo;
  if (filters.kycVerifiedFrom) qs.kycVerifiedFrom = filters.kycVerifiedFrom;
  if (filters.kycVerifiedTo) qs.kycVerifiedTo = filters.kycVerifiedTo;
  if (filters.lastActiveFrom) qs.lastActiveFrom = filters.lastActiveFrom;
  if (filters.lastActiveTo) qs.lastActiveTo = filters.lastActiveTo;
  if (filters.sort) qs.sort = filters.sort;

  return qs;
}

export function usersListFiltersToExportFilters(
  filters: UsersListFilters,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (filters.q) out.q = filters.q;
  if (filters.role) out.role = filters.role;
  if (filters.staffRole) out.staffRole = filters.staffRole;
  if (filters.accountStatus) out.accountStatus = filters.accountStatus;
  else if (filters.suspendedOnly) out.suspendedOnly = true;
  if (filters.emailVerified !== undefined) out.emailVerified = filters.emailVerified;
  if (filters.kycStatuses?.length) out.kycStatuses = filters.kycStatuses;
  else if (filters.kycStatus) out.kycStatus = filters.kycStatus;
  if (filters.persona) out.persona = filters.persona;
  if (filters.twoFactorEnabled !== undefined) out.twoFactorEnabled = filters.twoFactorEnabled;
  if (filters.deletionRequestedOnly) out.deletionRequestedOnly = true;
  if (filters.hasMobile !== undefined) out.hasMobile = filters.hasMobile;
  if (filters.createdFrom) out.createdFrom = filters.createdFrom;
  if (filters.createdTo) out.createdTo = filters.createdTo;
  if (filters.kycVerifiedFrom) out.kycVerifiedFrom = filters.kycVerifiedFrom;
  if (filters.kycVerifiedTo) out.kycVerifiedTo = filters.kycVerifiedTo;
  if (filters.lastActiveFrom) out.lastActiveFrom = filters.lastActiveFrom;
  if (filters.lastActiveTo) out.lastActiveTo = filters.lastActiveTo;
  if (filters.sort) out.sort = filters.sort;
  return out;
}

export function countUsersListActiveFilters(filters: UsersListFilters): number {
  let n = 0;
  if (filters.q) n += 1;
  if (filters.accountStatus || filters.suspendedOnly) n += 1;
  if (filters.emailVerified !== undefined) n += 1;
  if (filters.kycStatus || filters.kycStatuses?.length) n += 1;
  if (filters.persona) n += 1;
  if (filters.twoFactorEnabled !== undefined) n += 1;
  if (filters.deletionRequestedOnly) n += 1;
  if (filters.hasMobile !== undefined) n += 1;
  if (filters.createdFrom || filters.createdTo) n += 1;
  if (filters.kycVerifiedFrom || filters.kycVerifiedTo) n += 1;
  if (filters.lastActiveFrom || filters.lastActiveTo) n += 1;
  if (filters.sort && filters.sort !== "created_desc") n += 1;
  return n;
}

export function hasUsersListActiveFilters(filters: UsersListFilters): boolean {
  return countUsersListActiveFilters(filters) > 0;
}
