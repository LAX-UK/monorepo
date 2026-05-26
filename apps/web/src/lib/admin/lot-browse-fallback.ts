import type { AdminLotLifecycleSummary, AdminLotPickerRow } from "@/lib/data/http/admin.server";
import { getAdminLotList } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";

export type AdminLotBrowseState = "available" | "returned" | "all";

export type LotForBrowseFallback = Lot & { lifecycleSummary?: AdminLotLifecycleSummary };

export type AttachableLotFilterInput = {
  state?: AdminLotBrowseState;
  sellerLegalEntityId?: string;
  excludeSaleId?: string;
};

const FALLBACK_FETCH_LIMIT = 100;

export function matchesBrowseState(lot: LotForBrowseFallback, state: AdminLotBrowseState): boolean {
  const returnCount = lot.lifecycleSummary?.returnCount ?? 0;
  if (state === "all") return true;
  if (state === "returned") return returnCount > 0;
  return returnCount === 0;
}

export function isAttachableLot(
  lot: LotForBrowseFallback,
  filters: AttachableLotFilterInput,
): boolean {
  if (lot.status !== "draft") return false;
  if (lot.saleId != null) return false;
  if (lot.archivedSeller) return false;
  if (filters.sellerLegalEntityId && lot.sellerLegalEntityId !== filters.sellerLegalEntityId) {
    return false;
  }
  return matchesBrowseState(lot, filters.state ?? "available");
}

export function mapLotToPickerRow(lot: LotForBrowseFallback): AdminLotPickerRow {
  const returnCount = lot.lifecycleSummary?.returnCount ?? 0;
  return {
    id: lot.id,
    title: lot.title,
    lifecycle: {
      kind: returnCount > 0 ? "returned" : "new_draft",
      returnedAt: null,
      lastSaleId: null,
      lastSaleName: null,
      returnCount,
    },
  };
}

export function filterAndPaginateAttachableLots(
  lots: LotForBrowseFallback[],
  filters: AttachableLotFilterInput & { limit: number; offset: number },
): { rows: AdminLotPickerRow[]; total: number } {
  const filtered = lots.filter((lot) => isAttachableLot(lot, filters));
  const rows = filtered
    .slice(filters.offset, filters.offset + filters.limit)
    .map(mapLotToPickerRow);
  return { rows, total: filtered.length };
}

/** Fallback when GET /admin/lots/browse is unavailable (404 on stale API builds). */
export async function getAdminLotBrowseFallback(params: {
  q?: string;
  state?: AdminLotBrowseState;
  excludeSaleId?: string;
  sellerLegalEntityId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminLotPickerRow[]; total: number }> {
  const lots = await getAdminLotList({
    status: "draft",
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    limit: FALLBACK_FETCH_LIMIT,
    offset: 0,
  });
  return filterAndPaginateAttachableLots(lots, {
    ...(params.state ? { state: params.state } : {}),
    ...(params.sellerLegalEntityId ? { sellerLegalEntityId: params.sellerLegalEntityId } : {}),
    ...(params.excludeSaleId ? { excludeSaleId: params.excludeSaleId } : {}),
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  });
}
