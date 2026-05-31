import type { adminUserListQuerySchema } from "@auction/validators";
import type { z } from "zod";

type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
import type { AdminUserListFilter } from "../services/interfaces/admin-user.js";

function isoDateStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDateEndExclusive(iso: string): Date {
  const d = isoDateStart(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function triStateToBool(value: "1" | "0" | undefined): boolean | undefined {
  if (value === "1") return true;
  if (value === "0") return false;
  return undefined;
}

/** Maps validated HTTP query to the admin user list filter (single mapping layer). */
export function mapAdminUserListQuery(q: AdminUserListQuery): AdminUserListFilter {
  const filter: AdminUserListFilter = {
    limit: q.limit,
    offset: q.offset,
    sort: q.sort,
  };

  if (q.q) filter.q = q.q;
  if (q.role) filter.role = q.role;
  if (q.staffRole) filter.staffRole = q.staffRole;

  if (q.status) {
    filter.accountStatus = q.status;
  } else if (q.suspended === "1") {
    filter.suspendedOnly = true;
  }

  const emailVerified = triStateToBool(q.emailVerified);
  if (emailVerified !== undefined) filter.emailVerified = emailVerified;

  if (q.emailStatus) filter.emailStatus = q.emailStatus;

  if (q.kycStatuses?.length) {
    filter.kycStatuses = q.kycStatuses;
  } else if (q.kycStatus) {
    filter.kycStatus = q.kycStatus;
  }

  if (q.persona) filter.persona = q.persona;

  const twoFactor = triStateToBool(q.twoFactor);
  if (twoFactor !== undefined) filter.twoFactorEnabled = twoFactor;

  if (q.deletionRequested === "1") filter.deletionRequestedOnly = true;

  const hasMobile = triStateToBool(q.hasMobile);
  if (hasMobile !== undefined) filter.hasMobile = hasMobile;

  if (q.createdFrom) filter.createdFrom = isoDateStart(q.createdFrom);
  if (q.createdTo) filter.createdToExclusive = isoDateEndExclusive(q.createdTo);
  if (q.kycVerifiedFrom) filter.kycVerifiedFrom = isoDateStart(q.kycVerifiedFrom);
  if (q.kycVerifiedTo) filter.kycVerifiedToExclusive = isoDateEndExclusive(q.kycVerifiedTo);
  if (q.lastActiveFrom) filter.lastActiveFrom = isoDateStart(q.lastActiveFrom);
  if (q.lastActiveTo) filter.lastActiveToExclusive = isoDateEndExclusive(q.lastActiveTo);

  return filter;
}
