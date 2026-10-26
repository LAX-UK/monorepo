import { SHOP_HELP_CONTACT } from "@/content/policies/help";
import { shopOrderHref } from "@/lib/account/shop-account-routes";
import {
  isShopCollectionFulfilment,
  resolveShopFulfilmentLabel,
} from "@/lib/presenters/shop-fulfilment.presenter";
import {
  type ShopStatusPresentation,
  resolveShopOrderStatusPresentation,
} from "@/lib/presenters/shop-status-presentation";
import type { OrderStatus, OrderSummary } from "@auction/shop-contracts";
import { formatGbpPence, formatShopDate, formatShopDateTime } from "@auction/shop-portal/vm";

type OrderLine = OrderSummary["lines"][number];
type Progress = NonNullable<OrderSummary["progress"]>;

/** Statuses of an order the shopper paid for, whatever happened afterwards. */
const PAID_STATUSES: ReadonlySet<OrderStatus> = new Set(["paid", "partially_refunded", "refunded"]);

/**
 * A real order: one the shopper paid for, including any later cancellation or refund. Checkout
 * attempts that never took payment (awaiting payment, expired, failed or cancelled before paying)
 * are not orders; one that can still be paid shows once as "Finish paying" instead.
 */
export function isPlacedShopOrder(order: Pick<OrderSummary, "status" | "paidAt">): boolean {
  if (PAID_STATUSES.has(order.status)) return true;
  return order.status === "cancelled" && order.paidAt !== null;
}

/** What the shopper quotes: "LAX-S-10482", or a date for an order read from an older shop-api. */
export function shopOrderReference(order: Pick<OrderSummary, "reference" | "createdAt">): string {
  return order.reference ?? `from ${formatShopDate(order.createdAt)}`;
}

/** "Order LAX-S-10482": the order page title and the name used in links to it. */
export function shopOrderName(order: Pick<OrderSummary, "reference" | "createdAt">): string {
  return `Order ${shopOrderReference(order)}`;
}

function lineTitle(line: OrderLine): string {
  return line.productTitle ?? line.artworkTitle ?? "Item";
}

function lineHref(line: OrderLine): string | null {
  if (line.productSlug) return `/merchandise/${line.productSlug}`;
  if (line.artworkSlug) return `/artworks/${line.artworkSlug}`;
  return null;
}

/** "Harbor Print", or "Harbor Print and 2 more" for a multi-item order. */
export function shopOrderTitle(order: Pick<OrderSummary, "lines">): string {
  const [first, ...rest] = order.lines;
  if (!first) return "Order";
  return rest.length > 0 ? `${lineTitle(first)} and ${rest.length} more` : lineTitle(first);
}

/** Statuses in which a paid order still holds its editions. */
const HOLDING_STATUSES: ReadonlySet<OrderStatus> = new Set(["paid", "partially_refunded"]);

/**
 * The edition a line holds ("Edition 3 of 24"). An edition number is shown only while a paid
 * order holds it: shop-api names none otherwise, and an order read from an older shop-api is
 * checked here too. Anything else shows the run instead ("Edition of 24").
 */
export function shopOrderLineEdition(line: OrderLine, status: OrderStatus): string | null {
  if (line.editionNumber && HOLDING_STATUSES.has(status)) {
    return line.editionSize
      ? `Edition ${line.editionNumber} of ${line.editionSize}`
      : `Edition ${line.editionNumber}`;
  }
  if (line.editionSize) return `Edition of ${line.editionSize}`;
  if (line.variantSku) return `SKU ${line.variantSku}`;
  return null;
}

function isCancelled(order: OrderSummary): boolean {
  return (
    order.progress?.status === "cancelled" ||
    (order.refunds ?? []).some((refund) => refund.kind === "cancellation")
  );
}

/** Where a paid order is now, in one label. Unpaid attempts keep their payment status. */
export function shopOrderProgressStatus(order: OrderSummary): ShopStatusPresentation {
  if (!isPlacedShopOrder(order)) return resolveShopOrderStatusPresentation(order.status);
  if (isCancelled(order)) return { label: "Cancelled", tone: "neutral" };
  if (order.status === "refunded") return { label: "Refunded", tone: "neutral" };
  if (order.status === "partially_refunded") return { label: "Partly refunded", tone: "warning" };
  switch (order.progress?.status) {
    case "in_production":
    case "awaiting_dispatch":
      return { label: "In production", tone: "pending" };
    case "in_transit":
      return { label: "Dispatched", tone: "pending" };
    case "ready_for_collection":
      return { label: "Ready to collect", tone: "accent" };
    case "in_storage":
      return { label: "Stored with LAX", tone: "success" };
    case "delivered":
      return { label: "Delivered", tone: "success" };
    case "collected":
      return { label: "Collected", tone: "success" };
    default:
      return { label: "Paid", tone: "success" };
  }
}

export type ShopOrderRowVm = {
  orderId: string;
  href: string;
  title: string;
  reference: string;
  /** Machine-readable date for `<time>`. */
  placedAt: string;
  placedLabel: string;
  totalLabel: string;
  refundLabel: string | null;
  status: ShopStatusPresentation;
  thumbnailUrl: string | null;
};

/** An unpaid checkout that can still be paid, offered once above the orders. */
export type ShopFinishPayingVm = {
  orderId: string;
  title: string;
  totalLabel: string;
  thumbnailUrl: string | null;
  /** Machine-readable end of the reservation, for `<time>`. */
  expiresAt: string;
  /** "Your editions are reserved until 14:32." */
  reservedLabel: string;
};

export type ShopOrderListVm = {
  finishPaying: ShopFinishPayingVm | null;
  rows: ShopOrderRowVm[];
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

function reservedLabel(expiresAt: string, now: Date): string {
  const sameDay = formatShopDate(expiresAt) === formatShopDate(now.toISOString());
  return sameDay
    ? `Your editions are reserved until ${timeFormat.format(new Date(expiresAt))}.`
    : `Your editions are reserved until ${formatShopDateTime(expiresAt)}.`;
}

/** The newest unpaid checkout whose reservation has not run out, if any. */
export function shopFinishPaying(
  orders: readonly OrderSummary[],
  now: Date,
): ShopFinishPayingVm | null {
  const open = orders
    .filter(
      (order) =>
        order.status === "pending_payment" &&
        order.checkoutExpiresAt &&
        Date.parse(order.checkoutExpiresAt) > now.getTime(),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (!open?.checkoutExpiresAt) return null;
  return {
    orderId: open.orderId,
    title: shopOrderTitle(open),
    totalLabel: formatGbpPence(open.totalPence),
    thumbnailUrl: open.lines[0]?.imageUrl ?? null,
    expiresAt: open.checkoutExpiresAt,
    reservedLabel: reservedLabel(open.checkoutExpiresAt, now),
  };
}

export function buildShopOrderListVm(orders: readonly OrderSummary[], now: Date): ShopOrderListVm {
  const rows = orders
    .filter(isPlacedShopOrder)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((order) => ({
      orderId: order.orderId,
      href: shopOrderHref(order.orderId),
      title: shopOrderTitle(order),
      reference: shopOrderReference(order),
      placedAt: order.createdAt,
      placedLabel: formatShopDate(order.createdAt),
      totalLabel: formatGbpPence(order.totalPence),
      refundLabel: order.refundedPence ? `${formatGbpPence(order.refundedPence)} refunded` : null,
      status: shopOrderProgressStatus(order),
      thumbnailUrl: order.lines[0]?.imageUrl ?? null,
    }));
  return { finishPaying: shopFinishPaying(orders, now), rows };
}

export type ShopOrderTimelineStep = {
  id: string;
  label: string;
  /** `done` reached; `next` the step we expect next; `upcoming` after that. */
  state: "done" | "next" | "upcoming";
  /** Machine-readable date for `<time>`; null when the date was not recorded. */
  dateTime: string | null;
  dateLabel: string | null;
  detail: string | null;
  link: { href: string; label: string } | null;
};

const STAGE_RANK: Record<Progress["status"], number> = {
  pending_production: 0,
  in_production: 1,
  awaiting_dispatch: 2,
  in_transit: 3,
  ready_for_collection: 3,
  in_storage: 4,
  delivered: 4,
  collected: 4,
  cancelled: -1,
};

type StageSpec = { id: string; label: string; rank: number; at: string | null };

function stagesFor(order: OrderSummary, progress: Progress | null): StageSpec[] {
  const production: StageSpec = {
    id: "production",
    label: "In production",
    rank: 1,
    at: progress?.productionStartedAt ?? null,
  };
  if (isShopCollectionFulfilment(order.fulfilment)) {
    return [
      production,
      {
        id: "ready",
        label: "Ready to collect",
        rank: 3,
        at: progress?.readyForCollectionAt ?? null,
      },
      { id: "collected", label: "Collected", rank: 4, at: progress?.possessionAt ?? null },
    ];
  }
  if (order.fulfilment === "lax_storage") {
    return [
      production,
      { id: "stored", label: "Stored with LAX", rank: 4, at: progress?.possessionAt ?? null },
    ];
  }
  return [
    production,
    { id: "dispatched", label: "Dispatched", rank: 3, at: progress?.dispatchedAt ?? null },
    { id: "delivered", label: "Delivered", rank: 4, at: progress?.possessionAt ?? null },
  ];
}

function dated(at: string | null): Pick<ShopOrderTimelineStep, "dateTime" | "dateLabel"> {
  return { dateTime: at, dateLabel: at ? formatShopDateTime(at) : null };
}

/** The highest stage reached, read from the fulfilment status a cancellation leaves behind. */
function reachedRank(progress: Progress | null): number {
  if (!progress) return 0;
  if (progress.status !== "cancelled") return STAGE_RANK[progress.status];
  if (progress.possessionAt) return 4;
  if (progress.dispatchedAt || progress.readyForCollectionAt) return 3;
  if (progress.productionStartedAt) return 1;
  return 0;
}

function trackingDetail(progress: Progress | null): Pick<ShopOrderTimelineStep, "detail" | "link"> {
  if (!progress?.trackingNumber) {
    return { detail: progress?.carrier ?? null, link: null };
  }
  const carrier = progress.carrier ? `${progress.carrier} · ` : "";
  return {
    detail: `${carrier}Tracking number ${progress.trackingNumber}`,
    link: progress.trackingUrl ? { href: progress.trackingUrl, label: "Track parcel" } : null,
  };
}

/**
 * The order's stages with the date each was reached: ordered, paid, production, then dispatch and
 * delivery or collection. A cancellation or a full refund ends the timeline where it happened, and
 * every refund is added with its date. Null for a checkout that was never paid.
 */
export function buildShopOrderTimeline(order: OrderSummary): ShopOrderTimelineStep[] | null {
  if (!isPlacedShopOrder(order)) return null;
  const progress = order.progress ?? null;
  const refunds = order.refunds ?? [];
  const cancelled = isCancelled(order);
  const ended = cancelled || order.status === "refunded";
  const rank = reachedRank(progress);

  const steps: ShopOrderTimelineStep[] = [
    {
      id: "ordered",
      label: "Ordered",
      state: "done",
      ...dated(order.createdAt),
      detail: null,
      link: null,
    },
    {
      id: "paid",
      label: "Paid",
      state: "done",
      ...dated(order.paidAt),
      detail: null,
      link: null,
    },
  ];

  let nextGiven = false;
  for (const stage of stagesFor(order, progress)) {
    const reached = rank >= stage.rank;
    if (!reached && ended) continue;
    const state = reached ? "done" : nextGiven ? "upcoming" : "next";
    if (!reached) nextGiven = true;
    steps.push({
      id: stage.id,
      label: stage.label,
      state,
      ...dated(reached ? stage.at : null),
      ...(stage.id === "dispatched" && reached
        ? trackingDetail(progress)
        : { detail: null, link: null }),
    });
  }

  if (cancelled) {
    const at =
      progress?.cancelledAt ??
      refunds.find((refund) => refund.kind === "cancellation")?.requestedAt ??
      null;
    steps.push({
      id: "cancelled",
      label: "Cancelled",
      state: "done",
      ...dated(at),
      detail: null,
      link: null,
    });
  }

  (order.problemReports ?? []).forEach((report, index) => {
    steps.push({
      id: `problem-${index}`,
      label: "Problem reported",
      state: "done",
      ...dated(report.reportedAt),
      detail: "Our team will reply by email.",
      link: null,
    });
  });

  refunds.forEach((refund, index) => {
    const amount = formatGbpPence(refund.amountPence);
    const done = refund.status === "succeeded";
    steps.push({
      id: `refund-${index}`,
      label: done ? `Refunded ${amount}` : `Refund of ${amount} in progress`,
      state: done ? "done" : "next",
      ...dated(done ? refund.refundedAt : refund.requestedAt),
      detail: "To your original payment method",
      link: null,
    });
  });
  return steps;
}

export type ShopOrderLineVm = {
  id: string;
  title: string;
  href: string | null;
  artist: string | null;
  edition: string | null;
  priceLabel: string;
  thumbnailUrl: string | null;
};

export type ShopOrderTotalsVm = {
  rows: Array<{ label: string; value: string; emphasis?: boolean }>;
  /** "Includes VAT of £22.50", stated once; null when the order recorded no VAT. */
  vatLine: string | null;
};

export function buildShopOrderLines(order: OrderSummary): ShopOrderLineVm[] {
  return order.lines.map((line) => ({
    id: line.orderLineId,
    title: lineTitle(line),
    href: lineHref(line),
    artist: line.artistName ?? null,
    edition: shopOrderLineEdition(line, order.status),
    priceLabel: formatGbpPence(line.unitPricePence),
    thumbnailUrl: line.imageUrl ?? null,
  }));
}

export function buildShopOrderTotals(order: OrderSummary): ShopOrderTotalsVm {
  const delivery = order.fulfilmentSurchargePence;
  const rows: ShopOrderTotalsVm["rows"] = [
    { label: "Items", value: formatGbpPence(order.merchandiseSubtotalPence) },
    {
      label: resolveShopFulfilmentLabel(order.fulfilment),
      value: delivery === 0 ? "Free" : formatGbpPence(delivery),
    },
    { label: "Total", value: formatGbpPence(order.totalPence), emphasis: true },
  ];
  if (order.refundedPence) {
    rows.push({ label: "Refunded", value: `−${formatGbpPence(order.refundedPence)}` });
  }
  const vat = order.vatIncludedPence;
  return {
    rows,
    vatLine: typeof vat === "number" && vat > 0 ? `Includes VAT of ${formatGbpPence(vat)}` : null,
  };
}

export type ShopOrderDeliveryVm = { method: string; lines: string[] };

const COUNTRY_NAMES: Record<string, string> = { GB: "United Kingdom" };

export function buildShopOrderDelivery(order: OrderSummary): ShopOrderDeliveryVm {
  const method = resolveShopFulfilmentLabel(order.fulfilment);
  const address = order.deliveryAddress;
  if (address) {
    return {
      method,
      lines: [
        address.recipientName,
        address.line1,
        address.line2,
        `${address.city} ${address.postcode}`,
        COUNTRY_NAMES[address.country] ?? address.country,
      ].filter((line): line is string => Boolean(line)),
    };
  }
  if (order.fulfilment === "collect_new_cavendish") {
    return {
      method,
      lines: [SHOP_HELP_CONTACT.address, "By appointment. We will contact you to arrange a time."],
    };
  }
  return { method, lines: [] };
}

/** Whether, and until when, the shopper can cancel or report a problem from the order page. */
export type ShopOrderProblemVm =
  | { kind: "open"; href: string; until: string | null }
  | { kind: "closed"; endedOn: string | null }
  | null;

export function shopOrderProblemHref(orderId: string): string {
  return `${shopOrderHref(orderId)}/report-a-problem`;
}

export function shopOrderInvoiceHref(orderId: string): string {
  return `${shopOrderHref(orderId)}/invoice`;
}

export function buildShopOrderProblem(order: OrderSummary): ShopOrderProblemVm {
  const window = order.problemReport;
  if (!window || !isPlacedShopOrder(order) || order.status === "refunded") return null;
  const endsOn = window.endsAt ? formatShopDate(window.endsAt) : null;
  if (window.open) {
    return { kind: "open", href: shopOrderProblemHref(order.orderId), until: endsOn };
  }
  return { kind: "closed", endedOn: endsOn };
}

export type ShopOrderDetailVm = {
  orderId: string;
  /** "Order LAX-S-10482": the page title. */
  title: string;
  placedLabel: string;
  status: ShopStatusPresentation;
  /** Set for an unpaid or abandoned checkout, which has no timeline. */
  notice: string | null;
  timeline: ShopOrderTimelineStep[] | null;
  lines: ShopOrderLineVm[];
  totals: ShopOrderTotalsVm;
  delivery: ShopOrderDeliveryVm;
  invoiceHref: string | null;
  problem: ShopOrderProblemVm;
  /** An unpaid checkout that can still be paid. */
  finishPaying: ShopFinishPayingVm | null;
};

export function buildShopOrderDetailVm(order: OrderSummary, now: Date): ShopOrderDetailVm {
  const placed = isPlacedShopOrder(order);
  const status = shopOrderProgressStatus(order);
  const finishPaying = shopFinishPaying([order], now);
  return {
    orderId: order.orderId,
    title: shopOrderName(order),
    placedLabel: `Placed ${formatShopDate(order.createdAt)}`,
    status,
    finishPaying,
    notice: placed
      ? null
      : finishPaying
        ? `${finishPaying.reservedLabel} Pay before then to keep them.`
        : order.status === "pending_payment"
          ? "The time to pay for this order has run out."
          : (resolveShopOrderStatusPresentation(order.status).hint ?? null),
    timeline: buildShopOrderTimeline(order),
    lines: buildShopOrderLines(order),
    totals: buildShopOrderTotals(order),
    delivery: buildShopOrderDelivery(order),
    invoiceHref: order.invoiceAvailable ? shopOrderInvoiceHref(order.orderId) : null,
    problem: buildShopOrderProblem(order),
  };
}
