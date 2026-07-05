import { parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import {
  type LegalEntityListFilters,
  parseLegalEntityListFilters,
} from "@/lib/admin/legal-entity-list-query";
import { getAdminLegalEntityList } from "@/lib/data/http/admin.server";

export type LegalEntitiesListQuery = AdminListQueryBase & LegalEntityListFilters;

export const legalEntitiesListController: IAdminListController<
  Awaited<ReturnType<typeof getAdminLegalEntityList>>["rows"][number],
  LegalEntitiesListQuery
> = {
  id: "legal-entities",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const filters = parseLegalEntityListFilters(sp);
    const query: LegalEntitiesListQuery = {
      limit: Math.min(50, base.limit),
      offset: base.offset,
      ...filters,
    };
    if (filters.q) query.q = filters.q;
    else if (base.q) query.q = base.q;
    return query;
  },
  async fetch(q) {
    const data = await getAdminLegalEntityList({
      limit: q.limit,
      offset: q.offset,
      ...(q.q ? { q: q.q } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.stripeLens ? { stripeDue: true } : {}),
    });
    return { rows: data.rows, total: data.total, offset: q.offset, limit: q.limit };
  },
};
