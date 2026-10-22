import { ADMIN_ORDER_STATUSES, type AdminOrderStatus } from "@auction/shop-contracts";
import {
  type RawSearchParams,
  calendarDayParam,
  listHref,
  oneOf,
  singleParam,
} from "./list-url-state";

export const ORDER_LIST_PATH = "/orders";

export { ADMIN_ORDER_STATUSES };

/** The order list's filter state, as it appears in the page URL. Every field is optional. */
export type OrderListQuery = {
  q?: string;
  status?: AdminOrderStatus;
  /** Inclusive first and last day (UK time) an order was created on. */
  from?: string;
  to?: string;
  cursor?: string;
};

export const ORDER_STATUS_LABELS: Record<AdminOrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  partially_refunded: "Part refunded",
  refunded: "Refunded",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export type OrderBadgeTone = "info" | "success" | "warning" | "danger" | "neutral";

export function orderStatusTone(status: string): OrderBadgeTone {
  switch (status) {
    case "paid":
      return "success";
    case "pending_payment":
      return "warning";
    case "partially_refunded":
    case "refunded":
      return "info";
    case "payment_failed":
      return "danger";
    default:
      return "neutral";
  }
}

/** Reads the URL, dropping anything unrecognised so a hand-edited link still opens the list. */
export function parseOrderListQuery(params: RawSearchParams): OrderListQuery {
  const q = singleParam(params.q);
  const status = oneOf(singleParam(params.status), ADMIN_ORDER_STATUSES);
  const from = calendarDayParam(singleParam(params.from));
  const to = calendarDayParam(singleParam(params.to));
  const cursor = singleParam(params.cursor);
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

/** True when any filter narrows the list; paging does not count. */
export function hasActiveOrderFilters(query: OrderListQuery): boolean {
  return Boolean(query.q || query.status || query.from || query.to);
}

/**
 * The list URL for `query` with `change` applied. Changing a filter returns to the first page,
 * because a cursor only means something under the filters it was issued for. A `null` clears a field.
 */
export function orderListHref(
  query: OrderListQuery,
  change: { [K in keyof OrderListQuery]?: OrderListQuery[K] | null } = {},
): string {
  const next: Record<string, string | undefined> = { ...query, cursor: undefined };
  for (const [key, value] of Object.entries(change)) next[key] = value ?? undefined;
  return listHref(ORDER_LIST_PATH, next);
}

/** The same URL but one page further on. */
export function orderListPageHref(query: OrderListQuery, cursor: string): string {
  return listHref(ORDER_LIST_PATH, { ...query, cursor });
}

/**
 * The query parameters the orders API expects for this URL state. A range typed the wrong way
 * round is swapped rather than refused, so picking the end date first still works.
 */
export function orderListApiQuery(query: OrderListQuery): Record<string, string> {
  const [createdFrom, createdTo] =
    query.from && query.to && query.from > query.to
      ? [query.to, query.from]
      : [query.from, query.to];
  const api: Record<string, string | undefined> = {
    q: query.q,
    status: query.status,
    createdFrom,
    createdTo,
  };
  return Object.fromEntries(Object.entries(api).filter(([, value]) => Boolean(value))) as Record<
    string,
    string
  >;
}

/** What staff quote as the order number: the first eight characters of the order id, as on the order page. */
export function orderNumber(orderId: string): string {
  return orderId.slice(0, 8);
}

/** The headline for a buyer: their name, else their email, else the account they bought with. */
export function orderBuyerName(order: {
  buyerName: string | null;
  buyerEmail: string | null;
}): string {
  return order.buyerName?.trim() || order.buyerEmail?.trim() || "Unknown buyer";
}

/** Shown under the name; omitted when the email already is the name. */
export function orderBuyerSecondary(order: {
  buyerName: string | null;
  buyerEmail: string | null;
}): string | null {
  return order.buyerName?.trim() ? (order.buyerEmail?.trim() ?? null) : null;
}
