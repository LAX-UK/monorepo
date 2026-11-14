import "server-only";

import { venuesListController } from "@/lib/admin/admin-list-controllers";
import { enrichVenueListWithLegalEntityNames } from "@/lib/admin/enrich-venue-list-rows";
import {
  sortVenuesStaffRows,
  toVenuesStaffRows,
  venuesSortState,
} from "@/lib/admin/venues/venues-staff-list.vm";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";

export type AdminVenuesListSearchParams = Record<string, string | string[] | undefined>;

/** One page of venues with the total behind it, and the organisation filter's display name. */
export async function loadAdminVenuesListPage(sp: AdminVenuesListSearchParams) {
  const query = venuesListController.parseQuery(sp);
  const legalEntityId = query.legalEntityId;

  let venues: AdminVenueListRow[] = [];
  let total = 0;
  let listError: string | null = null;

  try {
    const result = await venuesListController.fetch(query);
    venues = result.rows;
    total = result.total ?? venues.length;
  } catch (reason) {
    listError = reason instanceof Error ? reason.message : "Could not load venues.";
  }

  if (venues.length > 0) {
    venues = await enrichVenueListWithLegalEntityNames(venues);
  }

  let legalEntityDisplayName: string | null = null;
  if (legalEntityId) {
    const { resolveAdminLegalEntityForPickerAction } = await import(
      "@/lib/actions/admin-legal-entities-browse"
    );
    const resolved = await resolveAdminLegalEntityForPickerAction(legalEntityId).catch(() => null);
    if (resolved?.ok && resolved.data) {
      legalEntityDisplayName = resolved.data.displayName;
    }
  }

  return {
    query,
    venues,
    total,
    listError,
    legalEntityId: legalEntityId ?? null,
    legalEntityDisplayName,
    includeArchived: query.includeArchived ?? false,
  };
}

/**
 * The ids of the venues the list shows for this query, in its order: what a venue page opened
 * from the list pages through (Previous and Next). The same query and sort as the list, without
 * the organisation filter's name.
 */
export async function loadVenuesListIds(sp: AdminVenuesListSearchParams): Promise<string[]> {
  const sort = venuesSortState(sp.sort);
  const { rows } = await venuesListController.fetch(venuesListController.parseQuery(sp));
  // Organisation names are only needed to sort by them.
  const venues =
    sort.columnId === "organisation" && rows.length > 0
      ? await enrichVenueListWithLegalEntityNames(rows)
      : rows;
  return sortVenuesStaffRows(toVenuesStaffRows(venues), sort).map((row) => row.id);
}
