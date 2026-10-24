import { shopOrderHref } from "@/lib/account/shop-account-routes";
import { resolveShopFulfilmentLabel } from "@/lib/presenters/shop-fulfilment.presenter";
import {
  type ShopStatusPresentation,
  resolveShopOrderStatusPresentation,
} from "@/lib/presenters/shop-status-presentation";
import type { OrderStatus, OrderSummary } from "@auction/shop-contracts";
import { formatGbpPence, formatShopDate, formatShopDateTime } from "@auction/shop-portal/vm";

type OrderLine = OrderSummary["lines"][number];

/** Orders the shopper actually placed. Checkout attempts that never took payment are left out. */
const PLACED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "pending_payment",
  "paid",
  "partially_refunded",
  "refunded",
]);

/** Statuses where an assigned edition number belongs to the shopper. */
const OWNED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "paid",
  "partially_refunded",
  "refunded",
]);

/**
 * A real order: paid (and anything after payment, including refunds and a cancellation once paid)
 * or still awaiting payment. Expired, failed and cancelled-before-payment checkouts are not orders.
 */
export function isPlacedShopOrder(order: Pick<OrderSummary, "status" | "paidAt">): boolean {
  if (PLACED_STATUSES.has(order.status)) return true;
  return order.status === "cancelled" && order.paidAt !== null;
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

function orderStatus(order: Pick<OrderSummary, "status" | "paidAt">): ShopStatusPresentation {
  const status = resolveShopOrderStatusPresentation(order.status);
  if (order.status === "cancelled" && order.paidAt !== null) {
    return {
      ...status,
      hint: "This order was cancelled after payment. Any refund goes back to your original payment method.",
    };
  }
  return status;
}

export type ShopOrderRowVm = {
  orderId: string;
  href: string;
  title: string;
  /** Machine-readable date for `<time>`. */
  placedAt: string;
  placedLabel: string;
  totalLabel: string;
  refundLabel: string | null;
  status: ShopStatusPresentation;
  thumbnailUrl: string | null;
};

export type ShopOrderListVm = { kind: "orders"; rows: ShopOrderRowVm[] } | { kind: "empty" };

export function buildShopOrderListVm(orders: readonly OrderSummary[]): ShopOrderListVm {
  const rows = orders
    .filter(isPlacedShopOrder)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((order) => ({
      orderId: order.orderId,
      href: shopOrderHref(order.orderId),
      title: shopOrderTitle(order),
      placedAt: order.createdAt,
      placedLabel: formatShopDate(order.createdAt),
      totalLabel: formatGbpPence(order.totalPence),
      refundLabel: order.refundedPence ? `${formatGbpPence(order.refundedPence)} refunded` : null,
      status: orderStatus(order),
      thumbnailUrl: order.lines[0]?.imageUrl ?? null,
    }));
  return rows.length > 0 ? { kind: "orders", rows } : { kind: "empty" };
}

export type ShopOrderLineVm = {
  id: string;
  title: string;
  href: string | null;
  detail: string | null;
  priceLabel: string;
  thumbnailUrl: string | null;
};

export type ShopOrderDetailVm = {
  /** "Order from 14 Oct 2026": the page title and last breadcrumb until orders carry a number. */
  title: string;
  placedLabel: string;
  paidLabel: string | null;
  status: ShopStatusPresentation;
  fulfilmentLabel: string;
  addressLines: string[] | null;
  lines: ShopOrderLineVm[];
  totals: Array<{ label: string; value: string; emphasis?: boolean }>;
};

export function buildShopOrderDetailVm(order: OrderSummary): ShopOrderDetailVm {
  const ownsEditions = OWNED_STATUSES.has(order.status);
  const address = order.deliveryAddress;
  const totals: ShopOrderDetailVm["totals"] = [
    { label: "Items", value: formatGbpPence(order.merchandiseSubtotalPence) },
    { label: "Delivery", value: formatGbpPence(order.fulfilmentSurchargePence) },
    { label: "Total", value: formatGbpPence(order.totalPence), emphasis: true },
  ];
  if (order.refundedPence) {
    totals.push({ label: "Refunded", value: formatGbpPence(order.refundedPence) });
  }
  return {
    title: `Order from ${formatShopDate(order.createdAt)}`,
    placedLabel: formatShopDateTime(order.createdAt),
    paidLabel: order.paidAt ? formatShopDateTime(order.paidAt) : null,
    status: orderStatus(order),
    fulfilmentLabel: resolveShopFulfilmentLabel(order.fulfilment),
    addressLines: address
      ? [
          address.line1,
          ...(address.line2 ? [address.line2] : []),
          `${address.city}, ${address.postcode}`,
          address.country,
        ]
      : null,
    lines: order.lines.map((line) => ({
      id: line.orderLineId,
      title: lineTitle(line),
      href: lineHref(line),
      detail:
        ownsEditions && line.editionNumber
          ? `Edition ${line.editionNumber}`
          : line.variantSku
            ? `SKU ${line.variantSku}`
            : null,
      priceLabel: formatGbpPence(line.unitPricePence),
      thumbnailUrl: line.imageUrl ?? null,
    })),
    totals,
  };
}
