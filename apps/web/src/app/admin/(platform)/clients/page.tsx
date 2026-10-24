import { ClientsStaffList } from "@/components/admin/people/clients-staff-list";
import { toClientsStaffRows } from "@/lib/admin/people/clients-staff-list.vm";
import { loadAdminClientsListPage } from "@/lib/admin/people/load-clients-list-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { USERS_DIRECTORY_ACCESS, USER_MODERATION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { PageHeader } from "@auction/staff-ui";
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
  const sp = await searchParams;
  const { model, rows, summary, total, loadError, pagination } = await loadAdminClientsListPage(sp);
  const first = (pagination?.offset ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Collector and seller accounts. Open a client to see their activity, identity checks and account controls."
      />
      <ClientsStaffList
        rows={toClientsStaffRows(rows, model.listReturnTarget)}
        search={sp}
        counts={{ total: summary.total, active: summary.active, suspended: summary.suspended }}
        filterChips={model.activeFilterChips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          clearHref: chip.clearHref,
        }))}
        pagination={
          rows.length > 0
            ? {
                summary: `${first}–${first + rows.length - 1} of ${total} clients`,
                prevHref: pagination?.prevHref ?? null,
                nextHref: pagination?.nextHref ?? null,
              }
            : null
        }
        canModerate={userHasAccessTo(
          user.role as UserRole,
          user.staffRole ?? null,
          USER_MODERATION_ACCESS,
        )}
        exportFilters={model.exportFilters}
        loadError={loadError}
        filtered={model.hasFilters}
      />
    </div>
  );
}
