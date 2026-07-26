import "server-only";

import { venuesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref, firstString } from "@/lib/admin/admin-list-params";
import { buildVenuesActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { enrichVenueListWithLegalEntityNames } from "@/lib/admin/enrich-venue-list-rows";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { resolvePlatformCatalogLegalEntity } from "@/lib/data/http/platform-catalog.server";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";

export type AdminVenuesListSearchParams = Record<string, string | string[] | undefined>;

export async function loadAdminVenuesListPage(sp: AdminVenuesListSearchParams) {
  const openNewSheet = firstString(sp.new)?.trim() === "1";
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = venuesListController.parseQuery(sp);
  const includeArchived = query.includeArchived ?? false;
  const q = query.q ?? "";
  const legalEntityId = query.legalEntityId;

  let venues: AdminVenueListRow[] = [];
  let total = 0;
  let listError: string | null = null;
  let platformLegalEntityId: string | null = null;

  const [listResult, platformCatalog] = await Promise.allSettled([
    (async () => {
      const result = await venuesListController.fetch(query);
      venues = result.rows;
      total = result.total ?? venues.length;
    })(),
    resolvePlatformCatalogLegalEntity(),
  ]);

  if (listResult.status === "rejected") {
    listError =
      listResult.reason instanceof Error ? listResult.reason.message : "Could not load venues.";
  } else if (venues.length > 0) {
    venues = await enrichVenueListWithLegalEntityNames(venues);
  }

  if (platformCatalog.status === "fulfilled" && platformCatalog.value.ok) {
    platformLegalEntityId = platformCatalog.value.id;
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

  const activeLensId = includeArchived ? "archived" : "active";
  const activeFilterCount = [q, legalEntityId, includeArchived ? "includeArchived" : ""].filter(
    Boolean,
  ).length;
  const hasFilters = Boolean(q || legalEntityId || includeArchived);
  const activeFilterChips = buildVenuesActiveFilterChips(sp, {
    q,
    includeArchived,
    ...(legalEntityId ? { legalEntityId } : {}),
    legalEntityName: legalEntityDisplayName,
  });

  const boardPagination =
    !listError && total > 0 && (query.offset > 0 || query.offset + venues.length < total)
      ? {
          offset: query.offset,
          limit: query.limit,
          countOnPage: venues.length,
          total,
          prevHref:
            query.offset > 0
              ? buildListHref("/admin/venues", sp, {
                  offset: Math.max(0, query.offset - query.limit),
                })
              : null,
          nextHref:
            query.offset + venues.length < total
              ? buildListHref("/admin/venues", sp, { offset: query.offset + query.limit })
              : null,
        }
      : null;

  return {
    sp,
    query,
    openNewSheet,
    error,
    venues,
    total,
    listError,
    platformLegalEntityId,
    legalEntityId: legalEntityId ?? null,
    legalEntityDisplayName,
    includeArchived,
    q,
    activeLensId,
    activeFilterCount,
    hasFilters,
    activeFilterChips,
    boardPagination,
  };
}
