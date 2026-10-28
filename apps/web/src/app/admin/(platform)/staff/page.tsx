import { StaffDirectoryList } from "@/components/admin/people/staff-directory-list";
import { peopleRangeSummary } from "@/lib/admin/people/clients-staff-list.vm";
import { loadAdminStaffListPage } from "@/lib/admin/people/load-staff-list-page";
import { toStaffDirectoryRows } from "@/lib/admin/people/staff-directory-list.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  INVITATIONS_ACCESS,
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, userHasAccessTo } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Staff",
  "Internal team directory and staff role management.",
);

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminCapability(USERS_DIRECTORY_ACCESS, "/admin/staff");
  const role = user.role as UserRole;
  const staffRoles = user.staffRoles;
  const sp = await searchParams;
  const { model, rows, access, summary, total, loadError, pagination } =
    await loadAdminStaffListPage(sp);

  return (
    <StaffDirectoryList
      rows={toStaffDirectoryRows(rows, access, model.listReturnTarget)}
      search={sp}
      counts={{ total: summary.total, active: summary.active, suspended: summary.suspended }}
      filterChips={model.activeFilterChips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        clearHref: chip.clearHref,
      }))}
      pageSize={model.query.limit}
      pagination={
        rows.length > 0
          ? {
              summary: peopleRangeSummary(model.query.offset, rows.length, total, {
                one: "staff member",
                other: "staff members",
              }),
              prevHref: pagination?.prevHref ?? null,
              nextHref: pagination?.nextHref ?? null,
            }
          : null
      }
      canModerate={userHasAccessTo(role, staffRoles, USER_MODERATION_ACCESS)}
      canManageRoles={userHasAccessTo(role, staffRoles, USER_ROLE_MANAGEMENT_ACCESS)}
      canInvite={userHasAccessTo(role, staffRoles, INVITATIONS_ACCESS)}
      loadError={loadError}
      filtered={model.hasFilters}
    />
  );
}
