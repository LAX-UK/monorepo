import type { AdminUserListFilter } from "@auction/persistence/interfaces";
import type { ExportClientsFilters } from "@auction/validators";

function isoDateStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDateEndExclusive(iso: string): Date {
  const d = isoDateStart(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Maps export job filters to admin user list filter (export API uses JSON booleans). */
export function mapExportClientsFilters(
  raw: ExportClientsFilters,
  paging: { limit: number; offset: number },
): AdminUserListFilter {
  const filter: AdminUserListFilter = {
    limit: paging.limit,
    offset: paging.offset,
    sort: raw.sort,
  };

  if (raw.q) filter.q = raw.q;
  if (raw.role) filter.role = raw.role;
  if (raw.staffRole) filter.staffRole = raw.staffRole;
  if (raw.accountStatus) filter.accountStatus = raw.accountStatus;
  else if (raw.suspendedOnly) filter.suspendedOnly = true;

  if (raw.emailVerified !== undefined) filter.emailVerified = raw.emailVerified;
  if (raw.emailStatus) filter.emailStatus = raw.emailStatus;
  if (raw.kycStatuses?.length) filter.kycStatuses = raw.kycStatuses;
  else if (raw.kycStatus) filter.kycStatus = raw.kycStatus;
  if (raw.persona) filter.persona = raw.persona;
  if (raw.twoFactorEnabled !== undefined) filter.twoFactorEnabled = raw.twoFactorEnabled;
  if (raw.deletionRequestedOnly) filter.deletionRequestedOnly = true;
  if (raw.hasMobile !== undefined) filter.hasMobile = raw.hasMobile;

  if (raw.createdFrom) filter.createdFrom = isoDateStart(raw.createdFrom);
  if (raw.createdTo) filter.createdToExclusive = isoDateEndExclusive(raw.createdTo);
  if (raw.kycVerifiedFrom) filter.kycVerifiedFrom = isoDateStart(raw.kycVerifiedFrom);
  if (raw.kycVerifiedTo) filter.kycVerifiedToExclusive = isoDateEndExclusive(raw.kycVerifiedTo);
  if (raw.lastActiveFrom) filter.lastActiveFrom = isoDateStart(raw.lastActiveFrom);
  if (raw.lastActiveTo) filter.lastActiveToExclusive = isoDateEndExclusive(raw.lastActiveTo);

  return filter;
}
