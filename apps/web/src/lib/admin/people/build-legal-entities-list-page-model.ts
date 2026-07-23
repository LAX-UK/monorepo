import { buildListHref, parseListSearchParams } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import {
  buildLegalEntityActiveFilterChips,
  countLegalEntityListActiveFilters,
  hasLegalEntityListActiveFilters,
  parseLegalEntityListFilters,
} from "@/lib/admin/legal-entity-list-query";

export const LEGAL_ENTITIES_LIST_PATH = "/admin/legal-entities";

export type LegalEntitiesListSearchParams = {
  error?: string;
  success?: string;
  q?: string;
  status?: string;
  kind?: string;
  stripe?: string;
  limit?: string;
  offset?: string;
  entity?: string;
};

export function buildLegalEntitiesListPageModel(sp: LegalEntitiesListSearchParams) {
  const base = parseListSearchParams(sp);
  const limit = Math.min(50, Math.max(1, base.limit));
  const offset = Math.max(0, base.offset);
  const listFilters = parseLegalEntityListFilters(sp);
  const selectedEntityId = sp.entity?.trim() || undefined;

  const listQueryParams = {
    limit,
    offset,
    ...(listFilters.q ? { q: listFilters.q } : {}),
    ...(listFilters.status ? { status: listFilters.status } : {}),
    ...(listFilters.kind ? { kind: listFilters.kind } : {}),
    ...(listFilters.stripeLens ? { stripeDue: true as const } : {}),
  };

  return {
    basePath: LEGAL_ENTITIES_LIST_PATH,
    query: { offset, limit, ...listFilters },
    listQueryParams,
    listFilters,
    selectedEntityId,
    listReturnTarget: buildAdminListReturnTarget(LEGAL_ENTITIES_LIST_PATH, sp),
    stripeLens: listFilters.stripeLens === true,
    hasFilters: hasLegalEntityListActiveFilters(listFilters),
    activeFilterCount: countLegalEntityListActiveFilters(listFilters),
    activeFilterChips: buildLegalEntityActiveFilterChips(LEGAL_ENTITIES_LIST_PATH, sp, listFilters),
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(LEGAL_ENTITIES_LIST_PATH, sp, patch),
    buildDrawerHref: (entityId: string | null) =>
      buildListHref(LEGAL_ENTITIES_LIST_PATH, sp, entityId ? { entity: entityId } : { entity: "" }),
  };
}

export type LegalEntitiesListPageModel = ReturnType<typeof buildLegalEntitiesListPageModel>;
