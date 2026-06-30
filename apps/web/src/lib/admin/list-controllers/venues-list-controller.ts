import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";

export type VenuesListQuery = AdminListQueryBase & {
  includeArchived?: boolean | undefined;
  legalEntityId?: string | undefined;
};

export const venuesListController: IAdminListController<
  import("@/lib/services/interfaces/admin-venue-service").AdminVenueListRow,
  VenuesListQuery
> = {
  id: "venues",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const includeArchived = firstString(sp.includeArchived) === "true";
    const legalEntityId = firstString(sp.legalEntityId)?.trim() || undefined;
    return { ...base, includeArchived, legalEntityId, limit: Math.min(100, base.limit) };
  },
  async fetch(q) {
    const { getWriteContainer } = await import("@/lib/data/write-container.server");
    const result = await getWriteContainer().adminVenues.list({
      ...(q.legalEntityId ? { legalEntityId: q.legalEntityId } : {}),
      includeArchived: Boolean(q.includeArchived),
      limit: q.limit,
      offset: q.offset,
      ...(q.q?.trim() ? { q: q.q } : {}),
    });
    if (!result.ok) throw new Error(result.message);
    return { rows: result.data.venues, offset: q.offset, limit: q.limit, total: result.data.total };
  },
};
