import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import type { ListLotsParams } from "@/lib/data/contracts";
import { getAdminLotList } from "@/lib/data/http/admin.server";
import type { LotStatus } from "@auction/types";

export type LotsListQuery = AdminListQueryBase & {
  status?: LotStatus | undefined;
  artistId?: string | undefined;
  saleId?: string | undefined;
  categoryId?: string | undefined;
  sort?: ListLotsParams["sort"] | undefined;
  q?: string | undefined;
  viewPipeline?: boolean | undefined;
  needsPhotos?: boolean | undefined;
};

export const lotsListController: IAdminListController<
  Awaited<ReturnType<typeof getAdminLotList>>[number],
  LotsListQuery
> = {
  id: "lots",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const viewPipeline = firstString(sp.view) === "pipeline";
    const st = firstString(sp.status);
    const status = st && st !== "all" ? (st as LotStatus) : undefined;
    const artistId = firstString(sp.artistId);
    const saleId = firstString(sp.saleId);
    const categoryId = firstString(sp.categoryId);
    const sort = firstString(sp.sort) as ListLotsParams["sort"] | undefined;
    const needsPhotos = firstString(sp.needsPhotos) === "1";
    const qRaw = base.q?.trim();
    const q = qRaw ? qRaw.slice(0, 200) : undefined;
    /** Pipeline is a single-page board (max 200 rows). Cursor-based server pipeline is deferred until lists routinely exceed this cap. */
    const PIPELINE_LOT_CAP = 200;
    const limit = viewPipeline ? PIPELINE_LOT_CAP : Math.min(200, base.limit);
    return {
      ...base,
      limit,
      viewPipeline,
      status,
      artistId,
      saleId,
      categoryId,
      sort,
      q,
      needsPhotos,
    };
  },
  async fetch(q) {
    const fetchLimit = q.limit + 1;
    const p: ListLotsParams = {
      limit: fetchLimit,
      offset: q.offset,
    };
    if (q.status !== undefined) p.status = q.status;
    if (q.artistId !== undefined && q.artistId !== "") p.artistId = q.artistId;
    if (q.saleId !== undefined && q.saleId !== "") p.saleId = q.saleId;
    if (q.categoryId !== undefined && q.categoryId !== "") p.categoryId = q.categoryId;
    if (q.sort !== undefined) p.sort = q.sort;
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    if (q.needsPhotos) p.needsPhotos = true;
    const rows = await getAdminLotList(p);
    if (q.viewPipeline) {
      const hasNextPage = rows.length > q.limit;
      const pageRows = hasNextPage ? rows.slice(0, q.limit) : rows;
      return { rows: pageRows, offset: q.offset, limit: q.limit, hasNextPage };
    }
    const hasNextPage = rows.length > q.limit;
    const pageRows = hasNextPage ? rows.slice(0, q.limit) : rows;
    return { rows: pageRows, offset: q.offset, limit: q.limit, hasNextPage };
  },
};
