import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import {
  ADMIN_ORDER_STATUSES,
  type AdminOrderStatus,
  type AdminOrderSummary,
} from "@auction/shop-contracts";
import {
  type Metric,
  STAFF_DEFAULT_PAGE_SIZE,
  type SortState,
  type TeamView,
  decodeSort,
  encodeSort,
  formatGbp,
  formatStaffCalendarDay,
  metricChange,
  parseStaffPageSize,
  recordHrefInList,
} from "@auction/staff-ui";
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
  /** `failed`: only orders with a refund waiting for a retry. */
  refund?: "failed";
  /** Inclusive first and last day (UK time) an order was created on. */
  from?: string;
  to?: string;
  /** The page's order, e.g. `total` or `-total`; absent for the default, newest first. */
  sort?: string;
  cursor?: string;
  /** Rows per page when not the default 50 (25 or 100). */
  limit?: string;
};

/** The columns a page of orders can be put in order by, and the default: newest first. */
const ORDER_SORT_COLUMNS = ["total", "created"] as const;
export const ORDER_DEFAULT_SORT: SortState = { columnId: "created", direction: "desc" };

function orderSortParam(value: string | undefined): string | undefined {
  const sort = decodeSort(value);
  if (!sort || !(ORDER_SORT_COLUMNS as readonly string[]).includes(sort.columnId)) return undefined;
  const encoded = encodeSort(sort);
  return encoded === encodeSort(ORDER_DEFAULT_SORT) ? undefined : encoded;
}

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
  const refund = singleParam(params.refund) === "failed" ? ("failed" as const) : undefined;
  const from = calendarDayParam(singleParam(params.from));
  const to = calendarDayParam(singleParam(params.to));
  const sort = orderSortParam(singleParam(params.sort));
  const cursor = singleParam(params.cursor);
  const limit = parseStaffPageSize(singleParam(params.limit));
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(refund ? { refund } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(sort ? { sort } : {}),
    ...(cursor ? { cursor } : {}),
    ...(limit !== STAFF_DEFAULT_PAGE_SIZE ? { limit: String(limit) } : {}),
  };
}

/** True when any filter narrows the list; paging does not count. */
export function hasActiveOrderFilters(query: OrderListQuery): boolean {
  return Boolean(query.q || query.status || query.refund || query.from || query.to);
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

/** How the page of orders is put in order. */
export function orderSortState(query: OrderListQuery): SortState {
  return decodeSort(query.sort) ?? ORDER_DEFAULT_SORT;
}

/**
 * The same page in a new order. The sort orders the rows already loaded, so it keeps the page;
 * the default leaves the URL bare.
 */
export function orderListSortHref(query: OrderListQuery, sort: SortState | null): string {
  return listHref(ORDER_LIST_PATH, {
    ...query,
    sort: sort ? orderSortParam(encodeSort(sort)) : undefined,
  });
}

/** The page's rows in the order asked for: by total or by when they were created. */
export function sortOrderRows<T extends { totalPence: number; createdAt: string }>(
  rows: readonly T[],
  sort: SortState,
): T[] {
  const value = (row: T) => (sort.columnId === "total" ? row.totalPence : row.createdAt);
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    return left < right ? -factor : left > right ? factor : 0;
  });
}

/**
 * An order's page that remembers this list (filters and sort, not the page) as `?list=`, so its
 * pager and its way back keep the same list.
 */
export function orderRecordHref(query: OrderListQuery, orderId: string): string {
  const listQuery = orderListHref(query).split("?")[1] ?? "";
  return recordHrefInList(`${ORDER_LIST_PATH}/${encodeURIComponent(orderId)}`, listQuery);
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
    refund: query.refund,
    createdFrom,
    createdTo,
    limit: query.limit,
  };
  return Object.fromEntries(Object.entries(api).filter(([, value]) => Boolean(value))) as Record<
    string,
    string
  >;
}

export const CREATED_PRESETS = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
] as const;
export type CreatedPresetId = (typeof CREATED_PRESETS)[number]["id"];

/** The UK calendar day `daysAgo` days before `now`, as `YYYY-MM-DD`. */
function ukDay(now: Date, daysAgo: number): string {
  return dayKey(new Date(now.getTime() - daysAgo * 86_400_000), LONDON_TIME_ZONE);
}

/** A preset as the inclusive `from`/`to` days the list URL takes. */
export function createdPresetRange(id: CreatedPresetId, now: Date): { from: string; to: string } {
  const preset = CREATED_PRESETS.find((candidate) => candidate.id === id) ?? CREATED_PRESETS[0];
  return { from: ukDay(now, preset.days - 1), to: ukDay(now, 0) };
}

/** Which preset the URL's range is, if any, so the filter can show it as selected. */
export function matchCreatedPreset(query: OrderListQuery, now: Date): CreatedPresetId | null {
  if (!query.from || !query.to) return null;
  const match = CREATED_PRESETS.find((preset) => {
    const range = createdPresetRange(preset.id, now);
    return range.from === query.from && range.to === query.to;
  });
  return match?.id ?? null;
}

const TEAM_ORDER_VIEWS: ReadonlyArray<{
  id: string;
  label: string;
  status: AdminOrderStatus;
  preset: CreatedPresetId;
}> = [
  { id: "paid-this-week", label: "Paid this week", status: "paid", preset: "7d" },
  {
    id: "unpaid-this-week",
    label: "Awaiting payment this week",
    status: "pending_payment",
    preset: "7d",
  },
  {
    id: "failed-this-month",
    label: "Payment failed this month",
    status: "payment_failed",
    preset: "30d",
  },
  { id: "refunded-this-month", label: "Refunded this month", status: "refunded", preset: "30d" },
];

/**
 * Views of the orders list everyone sees: a status over a recent period. Fixed here, never
 * edited; the dates follow `now`, so "this week" is always the last seven days.
 */
export function orderTeamViews(now: Date): TeamView[] {
  return TEAM_ORDER_VIEWS.map(({ id, label, status, preset }) => {
    const href = orderListHref({ status, ...createdPresetRange(preset, now) });
    return { id: `team-${id}`, label, href, query: href.split("?")[1] ?? "" };
  });
}

/** "Tue 3 Mar – Mon 9 Mar" for a range chip; one day reads as that day. */
export function createdRangeLabel(query: OrderListQuery): string | null {
  if (!query.from && !query.to) return null;
  const format = formatStaffCalendarDay;
  if (query.from && query.to) {
    return query.from === query.to
      ? `Created ${format(query.from)}`
      : `Created ${format(query.from)} – ${format(query.to)}`;
  }
  return query.from
    ? `Created from ${format(query.from)}`
    : `Created until ${format(query.to ?? "")}`;
}

/**
 * What staff quote for an order: its reference ("LAX-S-10482"), as the shopper sees it. Where a
 * response carries no reference yet, the first eight characters of the order id.
 */
export function orderNumber(orderId: string, reference?: string | null): string {
  return reference?.trim() || orderId.slice(0, 8);
}

/** The headline for a buyer: their name, else their email, else the account they bought with. */
export function orderBuyerName(order: {
  buyerName: string | null;
  buyerEmail: string | null;
}): string {
  return order.buyerName?.trim() || order.buyerEmail?.trim() || "Unknown buyer";
}

/**
 * Shown under the name: the email, unless it already is the name, and "Guest" when the order
 * came through guest checkout rather than a LAX account.
 */
export function orderBuyerSecondary(order: {
  buyerName: string | null;
  buyerEmail: string | null;
  buyerIsGuest?: boolean;
}): string | null {
  const email = order.buyerName?.trim() ? (order.buyerEmail?.trim() ?? null) : null;
  if (!order.buyerIsGuest) return email;
  return email ? `Guest · ${email}` : "Guest";
}

/** How the buyer checked out, for the order's customer details. */
export function orderBuyerAccountLabel(order: { buyerIsGuest?: boolean }): string {
  return order.buyerIsGuest ? "Guest checkout, no LAX account" : "LAX Account";
}

/** The period line over the orders summary. */
export function orderMetricsPeriod(summary: AdminOrderSummary): string {
  return `All orders · last ${summary.periodDays} days`;
}

/**
 * The orders list's headline numbers over the summary window: what was paid and how many orders
 * came in, each with its daily trend, and the average paid order. Each carries the change
 * against the window before, when there was one.
 */
export function orderMetrics(summary: AdminOrderSummary): Metric[] {
  const basis = `vs previous ${summary.periodDays} days`;
  const count = new Intl.NumberFormat("en-GB");
  const average = (pence: number, orders: number) => (orders > 0 ? pence / orders : 0);
  const averageNow = average(summary.paidPence.current, summary.paidOrders.current);
  const averageBefore = average(summary.paidPence.prior, summary.paidOrders.prior);
  const change = (current: number, prior: number) =>
    metricChange({ current, prior, basis, rise: "good" });
  const paidChange = change(summary.paidPence.current, summary.paidPence.prior);
  const ordersChange = change(summary.orders.current, summary.orders.prior);
  const averageChange = change(averageNow, averageBefore);
  const days = summary.periodDays;
  return [
    {
      id: "paid",
      label: "Paid",
      tone: "positive",
      value: formatGbp(summary.paidPence.current),
      trend: summary.paidPence.daily,
      trendLabel: `Paid each day, last ${days} days`,
      ...(paidChange ? { comparison: paidChange } : {}),
    },
    {
      id: "orders",
      label: "Orders placed",
      value: count.format(summary.orders.current),
      trend: summary.orders.daily,
      trendLabel: `Orders placed each day, last ${days} days`,
      ...(ordersChange ? { comparison: ordersChange } : {}),
    },
    {
      id: "average",
      label: "Average paid order",
      value: summary.paidOrders.current > 0 ? formatGbp(Math.round(averageNow)) : null,
      ...(summary.paidOrders.current > 0
        ? {
            trend: dailyAveragePence(summary, averageBefore),
            trendLabel: `Average of the orders paid each day, last ${days} days; a day without one keeps the day before`,
            ...(averageChange ? { comparison: averageChange } : {}),
          }
        : {}),
    },
  ];
}

/**
 * The average paid order for each day. A day with no paid orders has no average of its own, so
 * it keeps the previous day's (or, before the first order, the previous window's), rather than
 * dropping to zero.
 */
export function dailyAveragePence(summary: AdminOrderSummary, before: number): number[] {
  const firstPaid = summary.paidOrders.daily.findIndex((orders) => orders > 0);
  const firstAverage =
    firstPaid >= 0
      ? (summary.paidPence.daily[firstPaid] ?? 0) / (summary.paidOrders.daily[firstPaid] ?? 1)
      : 0;
  let last = before > 0 ? before : firstAverage;
  return summary.paidOrders.daily.map((orders, index) => {
    if (orders > 0) last = (summary.paidPence.daily[index] ?? 0) / orders;
    return Math.round(last);
  });
}
