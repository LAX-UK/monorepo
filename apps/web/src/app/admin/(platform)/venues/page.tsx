import { VenuesStaffList } from "@/components/admin/venues/venues-staff-list";
import { loadAdminVenuesListPage } from "@/lib/admin/catalog/load-venues-list-page";
import {
  toVenuesStaffRows,
  venuesActiveView,
  venuesFilterChips,
  venuesListHref,
  venuesRangeSummary,
  venuesViews,
} from "@/lib/admin/venues/venues-staff-list.vm";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Venues",
  "Manage reusable onsite gallery and branch information.",
);

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  if ((sp.new ?? "").toString().trim() === "1") {
    redirect("/admin/venues/new");
  }
  const loaded = await loadAdminVenuesListPage(sp);
  const { query, venues, total, listError, legalEntityId, legalEntityDisplayName } = loaded;
  const organisation = { id: legalEntityId, name: legalEntityDisplayName };

  return (
    <VenuesStaffList
      rows={toVenuesStaffRows(venues)}
      search={sp}
      views={venuesViews(sp)}
      activeView={venuesActiveView(loaded.includeArchived)}
      filterChips={venuesFilterChips(sp, organisation)}
      organisation={organisation}
      pageSize={query.limit}
      pagination={
        !listError && venues.length > 0
          ? {
              summary: venuesRangeSummary(query.offset, venues.length, total),
              prevHref:
                query.offset > 0
                  ? venuesListHref(sp, { offset: Math.max(0, query.offset - query.limit) })
                  : null,
              nextHref:
                query.offset + venues.length < total
                  ? venuesListHref(sp, { offset: query.offset + query.limit })
                  : null,
            }
          : null
      }
      listError={listError ?? loaded.error}
      filtered={Boolean(query.q || legalEntityId)}
    />
  );
}
