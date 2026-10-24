import { LotsStaffList } from "@/components/admin/lots/lots-staff-list";
import { AdminWithdrawalsBoard } from "@/components/admin/withdrawals-board";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { loadAdminLotsListPage } from "@/lib/admin/lots/load-lots-list-page";
import { toLotsStaffRows } from "@/lib/admin/lots/lots-staff-list.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { PageHeader, Section, StaffButton } from "@auction/staff-ui";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate("Lots", "Catalogue and manage auction lots.");

type LotsSearch = Record<string, string | undefined>;

export default async function AdminLotsPage({
  searchParams,
}: { searchParams: Promise<LotsSearch> }) {
  const user = await requireAdminCapability(LOTS_ACCESS, "/admin/lots");
  const role = user.role as UserRole;
  const canManageAuction = userHasAccessTo(role, user.staffRole ?? null, SALES_ACCESS);
  const canManageCatalog = userHasAccessTo(role, user.staffRole ?? null, LOTS_ACCESS);
  const sp = await searchParams;
  if (sp.view === "pipeline") {
    redirect(buildListHref("/admin/lots", sp, { view: "", offset: 0 }));
  }
  const vm = await loadAdminLotsListPage(sp);
  const { model, pageRows, hasNextPage, listPaginationTotal } = vm;
  const { query } = model;
  const first = query.offset + 1;
  const last = query.offset + pageRows.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lots"
        description="Publish, schedule and triage catalogue lots. Open a lot to see it beside the list."
        {...(canManageCatalog
          ? {
              primaryAction: (
                <StaffButton asChild variant="primary" icon={<Plus aria-hidden />}>
                  <Link href="/admin/lots/new">New lot</Link>
                </StaffButton>
              ),
            }
          : {})}
      />
      {model.attentionLens && !vm.withdrawalLoadError && vm.withdrawalTasks.length > 0 ? (
        <Section
          title="Withdrawal requests"
          description={`${vm.withdrawalTasks.length} waiting for a decision`}
        >
          <AdminWithdrawalsBoard tasks={vm.withdrawalTasks} />
        </Section>
      ) : null}
      <LotsStaffList
        rows={toLotsStaffRows(vm.lotTableRows)}
        search={sp}
        lenses={vm.lensesItems}
        activeLens={model.activeLens}
        filterChips={vm.activeFilterChips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          clearHref: chip.clearHref,
        }))}
        sales={vm.lotFilterOptions.sales.map((sale) => ({ id: sale.id, title: sale.title }))}
        artists={vm.lotFilterOptions.artists.map((artist) => ({
          id: artist.id,
          displayName: artist.displayName,
        }))}
        pagination={
          pageRows.length > 0
            ? {
                summary: `${first}–${last}${listPaginationTotal !== undefined ? ` of ${listPaginationTotal}` : ""} lots`,
                prevHref:
                  query.offset > 0
                    ? model.buildPaginationHref({ offset: Math.max(0, query.offset - query.limit) })
                    : null,
                nextHref: hasNextPage
                  ? model.buildPaginationHref({ offset: query.offset + query.limit })
                  : null,
              }
            : null
        }
        canManageCatalog={canManageCatalog}
        canManageAuction={canManageAuction}
        exportFilters={model.exportFilters}
        listError={vm.listError}
        filtered={model.hasListFilters}
      />
    </div>
  );
}
