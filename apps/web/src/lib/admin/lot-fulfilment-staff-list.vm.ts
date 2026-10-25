import { buildListHref } from "@/lib/admin/admin-list-params";
import { LOT_FULFILMENT_LIST_PATH } from "@/lib/admin/build-lot-fulfilment-list-page-model";
import { defineListSort } from "@/lib/admin/define-list-sort";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type {
  AdminLotFulfilmentListRow,
  AdminLotFulfilmentListSummary,
} from "@/lib/data/http/admin-lot-fulfilment.shared";
import type { StatusPresentation } from "@auction/staff-ui";

export type LotFulfilmentListSearch = Record<string, string | string[] | undefined>;

/** The step a lot is at, as the queue and the lot's actions read it. */
export type LotFulfilmentStep =
  | "awaiting_payment"
  | "awaiting_release"
  | "released"
  | "ready_for_collection"
  | "in_transit"
  | "delivered"
  | "cancelled";

/** One lot in the fulfilment queue; plain data for the client component. */
export type LotFulfilmentStaffRow = {
  /** The lot's id: actions and the panel key on it. */
  id: string;
  title: string;
  /** "Lot 12 · Autumn sale". */
  context: string | null;
  step: LotFulfilmentStep | string;
  status: StatusPresentation;
  method: string | null;
  /** "Royal Mail · AB123456789GB". */
  shipping: string | null;
  updatedAt: string;
  lotHref: string;
  saleHref: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  collection: "Collection",
  shipping: "Shipping",
};

export function toLotFulfilmentStaffRows(
  rows: readonly AdminLotFulfilmentListRow[],
): LotFulfilmentStaffRow[] {
  return rows.map((row) => ({
    id: row.lotId,
    title: row.lotTitle?.trim() || "Untitled lot",
    context:
      [row.lotNumber != null ? `Lot ${row.lotNumber}` : null, row.saleTitle]
        .filter(Boolean)
        .join(" · ") || null,
    step: row.status,
    status: staffStatus("fulfilment", row.status),
    method: row.fulfilmentMethod ? (METHOD_LABELS[row.fulfilmentMethod] ?? null) : null,
    shipping: [row.shippingCarrier, row.trackingNumber].filter(Boolean).join(" · ") || null,
    updatedAt: row.updatedAt,
    lotHref: `/admin/lots/${row.lotId}`,
    saleHref: row.saleId ? `/admin/sales/${row.saleId}` : null,
  }));
}

/** The queue's steps in the order a lot moves through them. */
export const FULFILMENT_VIEWS: readonly { id: LotFulfilmentStep; label: string }[] = [
  { id: "awaiting_payment", label: "Awaiting payment" },
  { id: "awaiting_release", label: "Awaiting release" },
  { id: "released", label: "Released" },
  { id: "ready_for_collection", label: "Ready for collection" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export function fulfilmentViewCount(
  summary: AdminLotFulfilmentListSummary,
  id: string,
): number | undefined {
  if (id === "all") return summary.total;
  return summary.statusCounts[id] ?? 0;
}

export function lotFulfilmentListHref(
  current: LotFulfilmentListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  return buildListHref(LOT_FULFILMENT_LIST_PATH, current, {
    offset: 0,
    lot: null,
    error: null,
    success: null,
    ...patch,
  });
}

/** The queue with this lot's panel open (`?lot=`), or closed for null. */
export function lotFulfilmentPanelHref(
  current: LotFulfilmentListSearch,
  lotId: string | null,
): string {
  return buildListHref(LOT_FULFILMENT_LIST_PATH, current, { lot: lotId, error: null });
}

/** Most recently changed first, unless the person sorts by lot or oldest change. */
export const lotFulfilmentSort = defineListSort(
  {
    lot: { asc: "lot_asc", desc: "lot_desc" },
    updated: { asc: "updated_asc", desc: "updated_desc" },
  },
  "updated_desc",
);
