import { buildListHref } from "@/lib/admin/admin-list-params";
import { LOT_FULFILMENT_LIST_PATH } from "@/lib/admin/build-lot-fulfilment-list-page-model";
import { visitWhen } from "@/lib/admin/collections/desk.vm";
import { defineListSort } from "@/lib/admin/define-list-sort";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type {
  AdminLotFulfilmentCourierPaid,
  AdminLotFulfilmentListRow,
  AdminLotFulfilmentListSummary,
} from "@/lib/data/http/admin-lot-fulfilment.shared";
import { formatMoney } from "@/lib/ui/format";
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
  /** "Thu 12 Nov, 14:00–14:30 GMT" for the booked visit; `null` when there is none. */
  collection: string | null;
  updatedAt: string;
  lotHref: string;
  saleHref: string | null;
  saleTitle: string | null;
  /**
   * Courier charges the buyer already paid inside a combined payment. Shown as "Paid with
   * invoice" so nobody takes the courier money again by hand; empty when there are none.
   */
  courierPaid: LotFulfilmentCourierPaidView[];
};

/** A courier charge paid with the invoice, as the queue shows it and a refund names it. */
export type LotFulfilmentCourierPaidView = {
  paymentGroupId: string;
  deliveryQuoteId: string;
  /** "Paid with invoice · £180.00", with what was refunded when any was. */
  label: string;
  /** What can still go back to the buyer, in pence; 0 once the courier charge is refunded. */
  remainingPence: number;
  /** "£180.00": the most a refund can return now. */
  remainingLabel: string;
};

/** The marker's short text, for the Method column and the row badge. */
export const COURIER_PAID_WITH_INVOICE = "Courier paid with invoice";

export function toCourierPaidView(
  paid: AdminLotFulfilmentCourierPaid,
): LotFulfilmentCourierPaidView {
  const chargedPence = Math.round(Number(paid.amount) * 100);
  const remainingPence = Math.max(0, chargedPence - paid.refundedPence);
  const charged = formatMoney(chargedPence / 100);
  const refunded =
    paid.refundedPence <= 0
      ? ""
      : remainingPence === 0
        ? " · refunded"
        : ` · ${formatMoney(paid.refundedPence / 100)} refunded`;
  return {
    paymentGroupId: paid.paymentGroupId,
    deliveryQuoteId: paid.deliveryQuoteId,
    label: `Paid with invoice · ${charged}${refunded}`,
    remainingPence,
    remainingLabel: formatMoney(remainingPence / 100),
  };
}

/** Statuses where a collection lot still waits to be handed over. */
const AWAITING_HAND_OVER = new Set(["released", "ready_for_collection"]);

/**
 * What the Collection column says: the visit, or "Not booked" for a collection lot that still
 * waits to be handed over. Blank for lots that ship, have no method yet, or are collected,
 * delivered or cancelled.
 */
export function collectionLabel(
  row: Pick<LotFulfilmentStaffRow, "collection" | "method" | "step">,
): string | null {
  if (row.collection) return row.collection;
  if (row.method !== "Collection") return null;
  return AWAITING_HAND_OVER.has(row.step) ? "Not booked" : null;
}

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
    collection: row.collectionVisit ? visitWhen(row.collectionVisit) : null,
    updatedAt: row.updatedAt,
    lotHref: `/admin/lots/${row.lotId}`,
    saleHref: row.saleId ? `/admin/sales/${row.saleId}` : null,
    saleTitle: row.saleTitle,
    courierPaid: (row.courierPaidWithInvoice ?? []).map(toCourierPaidView),
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
