import {
  ADMIN_REFUND_REASONS,
  type AdminOrderDetail,
  type AdminRefundReason,
} from "@auction/shop-contracts";
import {
  type CancellationStockOutcome,
  type RefundLineInput,
  SHOP_FULFILMENT_STATUSES,
  type ShopFulfilmentStatus,
  cancellationStockOutcome,
  cancelledLineIds,
  isShopFulfilmentStatus,
  nextFulfilmentStatuses,
  remainingRefundablePence,
} from "@auction/shop-domain";
import {
  type EntityOption,
  type EnumOption,
  type StatusPresentation,
  type TimelineEvent,
  formatGbp,
  formatStaffDateTime,
  humanizeStatus,
} from "@auction/staff-ui";
import { orderNumber } from "./order-list.vm";
import { presentStatus, staffStatusLabel } from "./staff-status";

/*
 * How an order reads on its page and in the quick-view panel: one status mapping per domain
 * (order, fulfilment, refund, production), the order's timeline, and the choices each form may
 * offer. Pure, so the rules are tested without rendering.
 */

export const presentOrderStatus = presentStatus("order");

export const FULFILMENT_STATUS_LABELS = Object.fromEntries(
  SHOP_FULFILMENT_STATUSES.map((status) => [status, staffStatusLabel("fulfilment", status)]),
) as Record<ShopFulfilmentStatus, string>;

export const presentFulfilmentStatus = presentStatus("fulfilment");
export const presentRefundStatus = presentStatus("refund");
export const presentProductionStatus = presentStatus("production");
export const presentFramingTaskStatus = presentStatus("framingTask");

const FULFILMENT_OPTION_LABELS: Record<string, string> = {
  uk_insured_delivery: "UK insured delivery",
  collect_new_cavendish: "Collect from New Cavendish Street",
  collect_brunswick: "Collect from Brunswick",
  lax_storage: "LAX storage",
  international_quotation: "International (quoted)",
};

export function fulfilmentOptionLabel(option: string): string {
  return FULFILMENT_OPTION_LABELS[option] ?? humanizeStatus(option);
}

export const REFUND_REASON_LABELS: Record<AdminRefundReason, string> = {
  customer_request: "Customer asked to return or cancel",
  damaged_in_transit: "Damaged in transit",
  not_as_described: "Not as described",
  duplicate_payment: "Duplicate payment",
  goodwill: "Goodwill gesture",
  other: "Other",
};

export const REFUND_REASON_OPTIONS: EnumOption<AdminRefundReason>[] = ADMIN_REFUND_REASONS.map(
  (reason) => ({ value: reason, label: REFUND_REASON_LABELS[reason] }),
);

type OrderLine = AdminOrderDetail["lines"][number];

/** A line as staff know it: the artwork or product, and the edition. */
export function orderLineLabel(line: OrderLine): string {
  if (line.kind === "framing") return `${line.framing?.name ?? "Frame"} (framing)`;
  const title = line.artworkTitle ?? line.productTitle ?? line.sku ?? "Item";
  return line.editionNumber == null ? title : `${title}, edition ${line.editionNumber}`;
}

/** The lines as picker options: the whole order first, then each line with its price. */
export function refundTargetOptions(detail: AdminOrderDetail): EntityOption[] {
  const hasCancelledItems = cancelledLineIds(orderRefundInputs(detail)).size > 0;
  return [
    {
      id: "",
      label: "Whole order",
      description: `${orderNumber(detail.orderId, detail.reference)} · ${formatGbp(detail.totalPence)}${
        hasCancelledItems ? " · cancelled items excluded" : ""
      }`,
    },
    ...detail.lines.map((line) => ({
      id: line.orderLineId,
      label: orderLineLabel(line),
      description: formatGbp(line.unitPricePence),
    })),
  ];
}

const REFUND_STATUSES = ["pending", "succeeded", "failed", "cancelled"] as const;

function isRefundStatus(status: string): status is (typeof REFUND_STATUSES)[number] {
  return (REFUND_STATUSES as readonly string[]).includes(status);
}

/** The order's refunds in the shape the refundable-balance rules read; unknown statuses drop out. */
function orderRefundInputs(detail: AdminOrderDetail): RefundLineInput[] {
  return detail.refunds.flatMap((refund) =>
    isRefundStatus(refund.status)
      ? [
          {
            amountPence: refund.amountPence,
            status: refund.status,
            orderLineId: refund.orderLineId,
            ...(isRefundSource(refund.source) ? { source: refund.source } : {}),
          },
        ]
      : [],
  );
}

const REFUND_SOURCES = ["admin", "cancellation", "stripe_dashboard"] as const;

function isRefundSource(source: string): source is (typeof REFUND_SOURCES)[number] {
  return (REFUND_SOURCES as readonly string[]).includes(source);
}

/** What may still be refunded, for the whole order or one line, after earlier refunds. */
export function refundableRemainingPence(detail: AdminOrderDetail, orderLineId: string | null) {
  const line = orderLineId
    ? detail.lines.find((candidate) => candidate.orderLineId === orderLineId)
    : undefined;
  return remainingRefundablePence({
    orderTotalPence: detail.totalPence,
    ...(line ? { lineTotalPence: line.unitPricePence, orderLineId: line.orderLineId } : {}),
    refunds: orderRefundInputs(detail),
    orderLines: detail.lines.map((candidate) => ({
      orderLineId: candidate.orderLineId,
      totalPence: candidate.unitPricePence,
    })),
  });
}

/**
 * What cancelling this item after possession would do: the customer is refunded what is left on
 * the line, to their card. Null once the item is cancelled or has nothing left to refund.
 */
export function lineCancellation(
  detail: AdminOrderDetail,
  line: OrderLine,
): { refundPence: number; stock: CancellationStockOutcome } | null {
  if (detail.status !== "paid" && detail.status !== "partially_refunded") return null;
  const refundPence = refundableRemainingPence(detail, line.orderLineId);
  if (refundPence <= 0) return null;
  const fulfilment = detail.fulfilmentRecord?.status;
  // With no fulfilment record there is no proof the item is still in the gallery.
  const stock =
    fulfilment && isShopFulfilmentStatus(fulfilment)
      ? cancellationStockOutcome(fulfilment)
      : "await_return";
  return { refundPence, stock };
}

const CANCELLATION_STOCK_COPY: Record<CancellationStockOutcome, string> = {
  restock_now: "The print never left the gallery, so it goes back on sale straight away.",
  await_return:
    "The print is with the customer, so a return is opened under Returns. It goes back on sale when you receive it.",
};

/** The dialog text for cancelling an item: what the system does, so staff never repeat it. */
export function cancelAfterPossessionDescription(
  refundPence: number,
  stock: CancellationStockOutcome,
): string {
  return `Use this when the customer cancels an item they already have. This refunds ${formatGbp(
    refundPence,
  )} for this item to the customer's card, and holds the artist's payout for it. ${CANCELLATION_STOCK_COPY[stock]} Do not refund the item again.`;
}

type Refund = AdminOrderDetail["refunds"][number];

/** The refund issued when this line was cancelled after possession, if there is one still in force. */
export function lineCancellationRefund(
  detail: AdminOrderDetail,
  orderLineId: string,
): Refund | null {
  return (
    detail.refunds.find(
      (refund) =>
        refund.orderLineId === orderLineId &&
        refund.source === "cancellation" &&
        refund.status !== "cancelled",
    ) ?? null
  );
}

const CANCELLED_LINE_BADGES: Record<string, StatusPresentation> = {
  pending: { label: "Cancelled, refund pending", tone: "warning" },
  succeeded: { label: "Cancelled, refunded", tone: "success" },
  failed: { label: "Cancelled, refund failed", tone: "danger" },
};

/** How a cancelled line reads in the items list, with its refund's state. */
export function cancelledLineBadge(refund: Refund): StatusPresentation {
  return (
    CANCELLED_LINE_BADGES[refund.status] ?? { label: "Cancelled after possession", tone: "neutral" }
  );
}

/** The refund row's note when finance settled it outside LAX: where it is, and who recorded it. */
export function settledOutsideNote(refund: Refund): string | null {
  const settled = refund.settledOutside;
  if (!settled) return null;
  const who = settled.byName ? ` Recorded by ${settled.byName}.` : "";
  return `Reference ${settled.reference}. ${settled.reason}.${who}`.replace(/\.\./g, ".");
}

/** Stripe's refund failure codes, in the words staff read. One table, used wherever one shows. */
const REFUND_FAILURE_MESSAGES: Record<string, string> = {
  charge_already_refunded: "The charge was already refunded in Stripe",
  charge_disputed: "The charge is being disputed, so Stripe cannot refund it",
  insufficient_funds: "There was not enough balance in Stripe to refund it",
  expired_or_canceled_card: "The card has expired or was closed",
  lost_or_stolen_card: "The card was reported lost or stolen",
  declined: "The card issuer declined the refund",
  refund_window_expired: "The refund window has passed",
  charge_for_pending_refund_disputed: "The charge has a dispute open, so the refund was refused",
  unknown: "Stripe could not process the refund",
};

/** A refund's failure as a sentence; an unknown code is kept in brackets so it can be looked up. */
export function refundFailureMessage(reason: string | null | undefined): string {
  const code = reason?.trim();
  if (!code) return REFUND_FAILURE_MESSAGES.unknown ?? "Stripe could not process the refund";
  return REFUND_FAILURE_MESSAGES[code] ?? `Stripe refused the refund (${code})`;
}

/** Refunds that could not be sent to the customer's card and wait for staff. */
export function failedRefunds(detail: AdminOrderDetail): Refund[] {
  return detail.refunds.filter((refund) => refund.status === "failed");
}

/** The Refunds list's second line: what was refunded, why it exists and when. */
export function refundRowContext(refund: Refund, line: OrderLine | undefined): string {
  const origin = refund.settledOutside
    ? "Refunded outside LAX"
    : refund.source === "cancellation"
      ? "Cancelled after possession"
      : humanizeStatus(refund.source);
  return `${line ? orderLineLabel(line) : "Whole order"} · ${origin} · ${formatStaffDateTime(
    refund.createdAt,
  )}`;
}

/** Only orders the customer paid for can be refunded. */
export function canRefundOrder(detail: AdminOrderDetail): boolean {
  return (
    (detail.status === "paid" || detail.status === "partially_refunded") &&
    refundableRemainingPence(detail, null) > 0
  );
}

/** The statuses staff may move this fulfilment to next, as select options; none when final. */
export function fulfilmentNextOptions(status: string): EnumOption<ShopFulfilmentStatus>[] {
  if (!isShopFulfilmentStatus(status)) return [];
  return nextFulfilmentStatuses(status).map((next) => ({
    value: next,
    label: FULFILMENT_STATUS_LABELS[next],
    ...(next === "cancelled" ? { description: "Stops fulfilment; refund separately" } : {}),
  }));
}

/** Lines that can be sent to production: an edition, and no task yet. */
export function productionCandidateLines(detail: AdminOrderDetail): OrderLine[] {
  return detail.lines.filter((line) => line.editionId && !line.production);
}

function money(value: unknown): string | null {
  return typeof value === "number" ? formatGbp(value) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** One audit entry as a sentence. Unknown actions still appear, by their humanised name. */
function describeActivity(entry: AdminOrderDetail["activity"][number]): {
  title: string;
  detail?: string;
  tone: TimelineEvent["tone"];
} {
  const detail = entry.detail ?? {};
  switch (entry.action) {
    case "request_refund": {
      const reason = text(detail.reason);
      const label =
        reason && reason in REFUND_REASON_LABELS
          ? REFUND_REASON_LABELS[reason as AdminRefundReason]
          : null;
      const note = text(detail.note);
      return {
        title: `Refund of ${money(detail.amountPence) ?? "an amount"} requested`,
        ...(label || note ? { detail: [label, note].filter(Boolean).join(" — ") } : {}),
        tone: "info",
      };
    }
    case "retry_refund":
      return {
        title: `Refund of ${money(detail.amountPence) ?? "an amount"} sent again`,
        tone: "info",
      };
    case "update_fulfilment": {
      const status = text(detail.status);
      const tracking = text(detail.trackingNumber);
      return {
        title: status
          ? `Fulfilment moved to ${presentFulfilmentStatus(status).label.toLowerCase()}`
          : "Fulfilment updated",
        ...(tracking
          ? { detail: `Tracking ${text(detail.carrier) ?? ""} ${tracking}`.replace(/\s+/g, " ") }
          : {}),
        tone: "neutral",
      };
    }
    case "record_possession":
      return { title: "Possession recorded", tone: "success" };
    case "create_production_task":
      return { title: "Sent to production", tone: "neutral" };
    case "production.update_task": {
      const status = text(detail.status);
      return {
        title: status
          ? `Production moved to ${presentProductionStatus(status).label.toLowerCase()}`
          : "Production task updated",
        tone: "neutral",
      };
    }
    case "cancel_after_possession":
      return {
        title: "Line cancelled after possession",
        ...(detail.stock === "restocked"
          ? { detail: "The print never left the gallery and is back on sale" }
          : detail.stock === "awaiting_return"
            ? { detail: "The print comes back to the gallery before it is sold again" }
            : {}),
        tone: "warning",
      };
    case "refund_settled_outside": {
      const reference = text(detail.reference);
      const reason = text(detail.reason);
      return {
        title: `Refund of ${money(detail.amountPence) ?? "an amount"} marked as refunded outside LAX`,
        ...(reference || reason
          ? {
              detail: [reference ? `Reference ${reference}` : null, reason]
                .filter(Boolean)
                .join(" — "),
            }
          : {}),
        tone: "success",
      };
    }
    case "return_in_transit":
      return { title: "Return marked in transit", tone: "info" };
    case "return_received": {
      const back = text(detail.disposition) === "back_on_sale";
      return {
        title: back ? "Return received and put back on sale" : "Return received and withdrawn",
        ...(back ? {} : { detail: "Damaged" }),
        tone: back ? "success" : "neutral",
      };
    }
    case "edition_back_on_sale":
      return { title: "Print back on sale", tone: "success" };
    default:
      return { title: humanizeStatus(entry.action), tone: "neutral" };
  }
}

/**
 * The order's history, newest first: what staff did (from the audit log) plus the moments the
 * system records on the order itself (placed, paid).
 */
export function buildOrderTimeline(detail: AdminOrderDetail): TimelineEvent[] {
  const events: TimelineEvent[] = detail.activity.map((entry) => {
    const described = describeActivity(entry);
    return {
      id: entry.auditId,
      title: described.title,
      at: entry.createdAt,
      actor: entry.actorName ?? "Staff",
      ...(described.detail ? { detail: described.detail } : {}),
      ...(described.tone ? { tone: described.tone } : {}),
    };
  });
  if (detail.paidAt) {
    events.push({
      id: "paid",
      title: `Paid ${formatGbp(detail.totalPence)}`,
      at: detail.paidAt,
      actor: "Stripe",
      tone: "success",
    });
  }
  events.push({
    id: "created",
    title: "Order placed",
    at: detail.createdAt,
    actor: detail.buyerName ?? detail.buyerEmail ?? "Customer",
  });
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
