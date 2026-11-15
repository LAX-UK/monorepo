import type { ListLotsParams } from "@/lib/data/contracts";

/** Query string for `GET /lots`; no request state, so session-free reads can use it. */
export function buildLotListQuery(params: ListLotsParams): Record<string, string> {
  const q: Record<string, string> = {
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
  };
  if (params.status) q.status = params.status;
  if (params.statuses?.length) q.statuses = params.statuses.join(",");
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.sellerId) q.sellerId = params.sellerId;
  if (params.winnerId) q.winnerId = params.winnerId;
  if (params.saleId) q.saleId = params.saleId;
  if (params.artistId) q.artistId = params.artistId;
  if (params.endYear !== undefined) q.endYear = String(params.endYear);
  if (params.sort) q.sort = params.sort;
  if (params.q?.trim()) q.q = params.q.trim();
  if (params.endingWithinHours !== undefined)
    q.endingWithinHours = String(params.endingWithinHours);
  if (params.needsPhotos) q.needsPhotos = "1";
  if (params.resolveImages === false) q.resolveImages = "0";
  return q;
}
