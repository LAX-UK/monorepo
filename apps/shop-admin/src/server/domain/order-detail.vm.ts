import {
  ADMIN_REFUND_REASONS,
  type AdminOrderDetail,
  type AdminRefundReason,
} from "@auction/shop-contracts";
import {
  SHOP_FULFILMENT_STATUSES,
  type ShopFulfilmentStatus,
  isShopFulfilmentStatus,
  nextFulfilmentStatuses,
  remainingRefundablePence,
} from "@auction/shop-domain";
import {
  type EntityOption,
  type EnumOption,
  type TimelineEvent,
  formatGbp,
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
  const title = line.artworkTitle ?? line.productTitle ?? line.sku ?? "Item";
  return line.editionNumber == null ? title : `${title}, edition ${line.editionNumber}`;
}

/** The lines as picker options: the whole order first, then each line with its price. */
export function refundTargetOptions(detail: AdminOrderDetail): EntityOption[] {
  return [
    {
      id: "",
      label: "Whole order",
      description: `${orderNumber(detail.orderId)} · ${formatGbp(detail.totalPence)}`,
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

/** What may still be refunded, for the whole order or one line, after earlier refunds. */
export function refundableRemainingPence(detail: AdminOrderDetail, orderLineId: string | null) {
  const line = orderLineId
    ? detail.lines.find((candidate) => candidate.orderLineId === orderLineId)
    : undefined;
  return remainingRefundablePence({
    orderTotalPence: detail.totalPence,
    ...(line ? { lineTotalPence: line.unitPricePence, orderLineId: line.orderLineId } : {}),
    refunds: detail.refunds.flatMap((refund) =>
      isRefundStatus(refund.status)
        ? [
            {
              amountPence: refund.amountPence,
              status: refund.status,
              orderLineId: refund.orderLineId,
            },
          ]
        : [],
    ),
  });
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
      return { title: "Line cancelled after possession", tone: "warning" };
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
