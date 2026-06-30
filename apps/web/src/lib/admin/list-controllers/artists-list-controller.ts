import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { type GetAdminArtistListParams, getAdminArtistList } from "@/lib/data/http/admin.server";
import type { AdminArtistListRow } from "@auction/types";

export type ArtistsListQuery = AdminListQueryBase & {
  includeArchived?: boolean | undefined;
  archivedOnly?: boolean | undefined;
  kind?: string | undefined;
  kinds?: string | undefined;
  status?: string | undefined;
  ownerUserId?: string | undefined;
  categoryId?: string | undefined;
  country?: string | undefined;
  featured?: boolean | undefined;
  verified?: boolean | undefined;
  linked?: "any" | "yes" | "no" | undefined;
  sort?: string | undefined;
};

export const artistsListController: IAdminListController<AdminArtistListRow, ArtistsListQuery> = {
  id: "artists",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const includeArchived = firstString(sp.includeArchived) === "true";
    const archivedOnly = firstString(sp.archivedOnly) === "true";
    const kind = firstString(sp.kind);
    const kinds = firstString(sp.kinds);
    const status = firstString(sp.status);
    const ownerUserId = firstString(sp.ownerUserId);
    const categoryId = firstString(sp.categoryId);
    const country = firstString(sp.country);
    const featured = firstString(sp.featured) === "true" || firstString(sp.featured) === "1";
    const verified = firstString(sp.verified) === "true" || firstString(sp.verified) === "1";
    const linkedRaw = firstString(sp.linked);
    const linked = linkedRaw === "yes" || linkedRaw === "no" ? linkedRaw : ("any" as const);
    const sort = firstString(sp.sort)?.trim() || undefined;
    return {
      ...base,
      includeArchived,
      archivedOnly,
      kind,
      kinds,
      status,
      ownerUserId,
      categoryId,
      country,
      featured: featured || undefined,
      verified: verified || undefined,
      linked,
      sort,
      limit: Math.min(200, base.limit),
    };
  },
  async fetch(q) {
    const p: GetAdminArtistListParams = {
      limit: q.limit,
      offset: q.offset,
    };
    if (q.sort) p.sort = q.sort;
    if (q.linked === "yes" || q.linked === "no") p.linked = q.linked;
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    if (q.includeArchived) p.includeArchived = true;
    if (q.archivedOnly) p.archivedOnly = true;
    if (q.kind !== undefined && q.kind !== "") p.kind = q.kind;
    if (q.kinds !== undefined && q.kinds !== "") p.kinds = q.kinds;
    if (q.status !== undefined && q.status !== "") p.status = q.status;
    if (q.ownerUserId !== undefined && q.ownerUserId !== "") p.ownerUserId = q.ownerUserId;
    if (q.categoryId !== undefined && q.categoryId !== "") p.categoryId = q.categoryId;
    if (q.country !== undefined && q.country !== "") p.country = q.country;
    if (q.featured) p.featured = true;
    if (q.verified) p.verified = true;
    const { rows, total } = await getAdminArtistList(p);
    return { rows, offset: q.offset, limit: q.limit, total };
  },
};
