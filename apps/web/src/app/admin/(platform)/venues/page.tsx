import { VenuesStaffList } from "@/components/admin/venues/venues-staff-list";
import { loadAdminVenuesListPage } from "@/lib/admin/catalog/load-venues-list-page";
import {
  sortVenuesStaffRows,
  toVenuesStaffRows,
  venuePanelRedirect,
  venuesActiveView,
  venuesFilterChips,
  venuesListHref,
  venuesRangeSummary,
  venuesSortState,
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
  // The venue panel is gone: an old shared `?venue=` link opens the venue's page.
  const panelRedirect = venuePanelRedirect(sp);
  if (panelRedirect) redirect(panelRedirect);
  if ((sp.new ?? "").toString().trim() === "1") {
    redirect("/admin/venues/new");
  }
  const loaded = await loadAdminVenuesListPage(sp);
  const { query, venues, total, listError, legalEntityId, legalEntityDisplayName } = loaded;
  const organisation = { id: legalEntityId, name: legalEntityDisplayName };
  // The venues API does not sort: the page of venues is put in the URL's order here.
  const sort = venuesSortState(sp.sort);

  return (
    <VenuesStaffList
      rows={sortVenuesStaffRows(toVenuesStaffRows(venues), sort)}
      search={sp}
      sort={sort}
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
      listError={listError}
      filtered={Boolean(query.q || legalEntityId)}
    />
  );
}
