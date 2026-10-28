import { ClientsStaffList } from "@/components/admin/people/clients-staff-list";
import { peopleRangeSummary, toClientsStaffRows } from "@/lib/admin/people/clients-staff-list.vm";
import { loadAdminClientsListPage } from "@/lib/admin/people/load-clients-list-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, userHasAccessTo } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Clients",
  "Browse collector and seller accounts.",
);

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminCapability(USERS_DIRECTORY_ACCESS, "/admin/clients");
  const role = user.role as UserRole;
  const staffRoles = user.staffRoles;
  const sp = await searchParams;
  const { model, rows, summary, total, loadError, pagination } = await loadAdminClientsListPage(sp);

  return (
    <ClientsStaffList
      rows={toClientsStaffRows(rows, model.listReturnTarget)}
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
                one: "client",
                other: "clients",
              }),
              prevHref: pagination?.prevHref ?? null,
              nextHref: pagination?.nextHref ?? null,
            }
          : null
      }
      canModerate={userHasAccessTo(role, staffRoles, USER_MODERATION_ACCESS)}
      canManageRoles={userHasAccessTo(role, staffRoles, USER_ROLE_MANAGEMENT_ACCESS)}
      exportFilters={model.exportFilters}
      loadError={loadError}
      filtered={model.hasFilters}
    />
  );
}
