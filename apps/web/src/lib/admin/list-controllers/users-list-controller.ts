import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { type UsersListFilters, parseUsersListFilters } from "@/lib/admin/users-list-query";
import { getAdminUserList } from "@/lib/data/http/admin.server";

export type UsersListQuery = AdminListQueryBase & UsersListFilters;

export const usersListController: IAdminListController<
  Awaited<ReturnType<typeof getAdminUserList>>["rows"][number],
  UsersListQuery
> = {
  id: "users",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const filters = parseUsersListFilters(sp);
    const role = firstString(sp.role);
    const staffRole = firstString(sp.staffRole);
    const query: UsersListQuery = {
      limit: Math.min(100, base.limit),
      offset: base.offset,
      ...filters,
    };
    if (filters.q) query.q = filters.q;
    else if (base.q) query.q = base.q;
    if (filters.sort) query.sort = filters.sort;
    if (role) query.role = role;
    if (staffRole) query.staffRole = staffRole;
    return query;
  },
  async fetch(q) {
    const data = await getAdminUserList({
      limit: q.limit,
      offset: q.offset,
      ...(q.q ? { q: q.q } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.staffRole ? { staffRole: q.staffRole } : {}),
      ...(q.accountStatus ? { accountStatus: q.accountStatus } : {}),
      ...(q.suspendedOnly ? { suspendedOnly: true } : {}),
      ...(q.emailVerified !== undefined ? { emailVerified: q.emailVerified } : {}),
      ...(q.kycStatuses?.length ? { kycStatuses: q.kycStatuses } : {}),
      ...(q.kycStatus ? { kycStatus: q.kycStatus } : {}),
      ...(q.persona ? { persona: q.persona } : {}),
      ...(q.twoFactorEnabled !== undefined ? { twoFactorEnabled: q.twoFactorEnabled } : {}),
      ...(q.deletionRequestedOnly ? { deletionRequestedOnly: true } : {}),
      ...(q.hasMobile !== undefined ? { hasMobile: q.hasMobile } : {}),
      ...(q.createdFrom ? { createdFrom: q.createdFrom } : {}),
      ...(q.createdTo ? { createdTo: q.createdTo } : {}),
      ...(q.kycVerifiedFrom ? { kycVerifiedFrom: q.kycVerifiedFrom } : {}),
      ...(q.kycVerifiedTo ? { kycVerifiedTo: q.kycVerifiedTo } : {}),
      ...(q.lastActiveFrom ? { lastActiveFrom: q.lastActiveFrom } : {}),
      ...(q.lastActiveTo ? { lastActiveTo: q.lastActiveTo } : {}),
      ...(q.sort ? { sort: q.sort } : {}),
    });
    return { rows: data.rows, total: data.total, offset: q.offset, limit: q.limit };
  },
};
