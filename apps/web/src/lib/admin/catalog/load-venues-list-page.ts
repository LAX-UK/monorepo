import "server-only";

import { venuesListController } from "@/lib/admin/admin-list-controllers";
import { enrichVenueListWithLegalEntityNames } from "@/lib/admin/enrich-venue-list-rows";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";

export type AdminVenuesListSearchParams = Record<string, string | string[] | undefined>;

/** One page of venues with the total behind it, and the organisation filter's display name. */
export async function loadAdminVenuesListPage(sp: AdminVenuesListSearchParams) {
  const error = safeDecodeAdminErrorParam(sp.error);
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
    error,
    venues,
    total,
    listError,
    legalEntityId: legalEntityId ?? null,
    legalEntityDisplayName,
    includeArchived: query.includeArchived ?? false,
  };
}
