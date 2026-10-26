import {
  ADMIN_ORDER_STATUSES,
  type AdminOrderStatus,
  type AdminOrderSummary,
} from "@auction/shop-contracts";
import {
  type Metric,
  STAFF_DEFAULT_PAGE_SIZE,
  type TeamView,
  formatGbp,
  metricChange,
  parseStaffPageSize,
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
  /** Inclusive first and last day (UK time) an order was created on. */
  from?: string;
  to?: string;
  cursor?: string;
  /** Rows per page when not the default 50 (25 or 100). */
  limit?: string;
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
  const limit = parseStaffPageSize(singleParam(params.limit));
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(cursor ? { cursor } : {}),
    ...(limit !== STAFF_DEFAULT_PAGE_SIZE ? { limit: String(limit) } : {}),
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

const UK_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The UK calendar day `daysAgo` days before `now`, as `YYYY-MM-DD`. */
function ukDay(now: Date, daysAgo: number): string {
  return UK_DAY.format(new Date(now.getTime() - daysAgo * 86_400_000));
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

/** "3 Mar – 9 Mar 2026" for a range chip; one day reads as that day. */
export function createdRangeLabel(query: OrderListQuery): string | null {
  if (!query.from && !query.to) return null;
  const format = (day: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day}T00:00:00Z`));
  if (query.from && query.to) {
    return query.from === query.to
      ? `Created ${format(query.from)}`
      : `Created ${format(query.from)} – ${format(query.to)}`;
  }
  return query.from
    ? `Created from ${format(query.from)}`
    : `Created until ${format(query.to ?? "")}`;
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
