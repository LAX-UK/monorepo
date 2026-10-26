import type { ShopFulfilmentStatus } from "./fulfilment-state.js";
import type { ShopOrderStatus } from "./order-state.js";

/** Days after delivery or collection in which a shopper may cancel, by law, without a reason. */
export const STATUTORY_CANCELLATION_DAYS = 14;

/** The fulfilment column that records when a stage was first reached. */
export type FulfilmentStageColumn =
  | "productionStartedAt"
  | "dispatchedAt"
  | "readyForCollectionAt"
  | "cancelledAt";

const STAGE_COLUMN: Partial<Record<ShopFulfilmentStatus, FulfilmentStageColumn>> = {
  in_production: "productionStartedAt",
  in_transit: "dispatchedAt",
  ready_for_collection: "readyForCollectionAt",
  cancelled: "cancelledAt",
};

/**
 * Which stage date a move to `status` records, if any. Delivery and collection are recorded as
 * possession, with the date staff enter, so they have no column here.
 */
export function fulfilmentStageColumn(status: ShopFulfilmentStatus): FulfilmentStageColumn | null {
  return STAGE_COLUMN[status] ?? null;
}

/**
 * A link to the carrier's own tracking page, for carriers whose page address is known. Any other
 * carrier gets no link, and the shopper sees the carrier and number as text.
 */
export function carrierTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const number = trackingNumber?.trim();
  if (!number) return null;
  const name = carrier?.trim().toLowerCase() ?? "";
  if (name.includes("royal mail")) {
    return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(number)}`;
  }
  return null;
}

/** Orders a shopper can still report a problem with: paid, and not wholly refunded. */
const REPORTABLE: ReadonlySet<ShopOrderStatus> = new Set(["paid", "partially_refunded"]);

export type OrderProblemWindow =
  | { open: true; endsAt: Date | null }
  | { open: false; reason: "not_paid" | "refunded" | "closed"; endsAt: Date | null };

/**
 * Whether "Report a problem" is open for an order. It opens on payment and stays open until the
 * cancellation period ends: the period recorded on the order, or 14 days after delivery or
 * collection when none was recorded. Before delivery there is no end date yet.
 */
export function orderProblemWindow(input: {
  status: ShopOrderStatus;
  paidAt: Date | null;
  refundPeriodEndsAt: Date | null;
  possessionAt: Date | null;
  now: Date;
}): OrderProblemWindow {
  const endsAt =
    input.refundPeriodEndsAt ??
    (input.possessionAt
      ? new Date(input.possessionAt.getTime() + STATUTORY_CANCELLATION_DAYS * 86_400_000)
      : null);
  if (input.status === "refunded") return { open: false, reason: "refunded", endsAt };
  if (!input.paidAt || !REPORTABLE.has(input.status)) {
    return { open: false, reason: "not_paid", endsAt };
  }
  if (endsAt && input.now.getTime() > endsAt.getTime()) {
    return { open: false, reason: "closed", endsAt };
  }
  return { open: true, endsAt };
}
