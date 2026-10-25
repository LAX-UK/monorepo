import { LotFulfilmentStaffList } from "@/components/admin/lot-fulfilment/lot-fulfilment-staff-list";
import { buildFulfilmentActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { loadAdminLotFulfilmentListPage } from "@/lib/admin/load-lot-fulfilment-list-page";
import {
  FULFILMENT_VIEWS,
  fulfilmentViewCount,
  toLotFulfilmentStaffRows,
} from "@/lib/admin/lot-fulfilment-staff-list.vm";
import { peopleRangeSummary } from "@/lib/admin/people/clients-staff-list.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOT_FULFILMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Lot fulfilment",
  "Release, shipping, and collection workflow for sold lots.",
);

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function AdminLotFulfilmentQueuePage({ searchParams }: Props) {
  const sp = await searchParams;
  await requireAdminCapability(LOT_FULFILMENT_ACCESS, "/admin/lot-fulfilment");

  const { model, rows, summary, total, loadError, pagination } =
    await loadAdminLotFulfilmentListPage(sp);
  const filterChips = buildFulfilmentActiveFilterChips(sp, {
    ...(model.query.q ? { q: model.query.q } : {}),
  });
  const counts = Object.fromEntries(
    ["all", ...FULFILMENT_VIEWS.map((view) => view.id)].map((id) => [
      id,
      fulfilmentViewCount(summary, id) ?? 0,
    ]),
  );

  return (
    <LotFulfilmentStaffList
      rows={toLotFulfilmentStaffRows(rows)}
      search={sp}
      counts={counts}
      filterChips={filterChips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        clearHref: chip.clearHref,
      }))}
      pageSize={model.query.limit}
      pagination={
        rows.length > 0
          ? {
              summary: peopleRangeSummary(model.query.offset, rows.length, total, {
                one: "lot",
                other: "lots",
              }),
              prevHref: pagination?.prevHref ?? null,
              nextHref: pagination?.nextHref ?? null,
            }
          : null
      }
      loadError={loadError}
      filtered={Boolean(model.query.q)}
    />
  );
}
