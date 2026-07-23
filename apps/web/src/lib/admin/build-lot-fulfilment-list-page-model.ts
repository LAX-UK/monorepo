import { buildListHref } from "@/lib/admin/admin-list-params";
import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";

export const LOT_FULFILMENT_LIST_PATH = "/admin/lot-fulfilment";

const FILTER_STATUSES = [
  "awaiting_payment",
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

export type LotFulfilmentListSearchParams = {
  error?: string;
  success?: string;
  status?: string;
  q?: string;
  limit?: string;
  offset?: string;
  lot?: string;
};

function parseStatusFilter(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return (FILTER_STATUSES as readonly string[]).includes(raw) ? raw : undefined;
}

export function buildLotFulfilmentListPageModel(sp: LotFulfilmentListSearchParams) {
  const base = parseListSearchParams(sp);
  const limit = Math.min(100, Math.max(1, base.limit));
  const offset = Math.max(0, base.offset);
  const status = parseStatusFilter(firstString(sp.status));
  const q = base.q?.trim() || undefined;
  const selectedLotId = sp.lot?.trim() || undefined;

  const listQueryParams = {
    limit,
    offset,
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
  };

  return {
    basePath: LOT_FULFILMENT_LIST_PATH,
    query: { offset, limit, status, q },
    listQueryParams,
    selectedLotId,
    returnStatus: status ?? "",
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(LOT_FULFILMENT_LIST_PATH, sp, patch),
    buildDrawerHref: (lotId: string | null) =>
      buildListHref(LOT_FULFILMENT_LIST_PATH, sp, lotId ? { lot: lotId } : { lot: "" }),
  };
}

export type LotFulfilmentListPageModel = ReturnType<typeof buildLotFulfilmentListPageModel>;
