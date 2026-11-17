import { buildListHref } from "@/lib/admin/admin-list-params";
import type { DeliveryEvent, DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { DELIVERY_STATUSES, type DeliveryStatus } from "@auction/domain";
import {
  type StatusPresentation,
  defineStatusMap,
  formatStaffDate,
  formatStaffDateTime,
  formatStaffMoney,
  formatStaffNumber,
  formatStaffRelative,
} from "@auction/staff-ui";
import { DELIVERIES_COPY, type DeliveryBadgeKey, type DeliverySinceKey } from "./deliveries-copy";

export const DELIVERIES_PATH = "/admin/deliveries";
/** The search param that holds the lot whose panel is open (PRD-7). */
export const DELIVERY_RECORD_PARAM = "record";

export type DeliveriesSearch = Record<string, string | string[] | undefined>;
export type DeliveriesSort = "newest" | "oldest";

/** The list's state as the URL carries it. */
export type DeliveriesFilters = {
  view: DeliveryStatus;
  q: string;
  saleId: string;
  sort: DeliveriesSort;
  limit: number;
  offset: number;
  /** The lot whose panel is open. */
  record: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZES = [25, 50, 100] as const;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function isDeliveryStatus(value: string): value is DeliveryStatus {
  return (DELIVERY_STATUSES as readonly string[]).includes(value);
}

export function parseDeliveriesSearch(sp: DeliveriesSearch): DeliveriesFilters {
  const view = first(sp.view);
  const saleId = first(sp.sale);
  const limit = Number.parseInt(first(sp.limit), 10);
  const offset = Number.parseInt(first(sp.offset), 10);
  const record = first(sp[DELIVERY_RECORD_PARAM]);
  return {
    view: isDeliveryStatus(view) ? view : "waiting",
    q: first(sp.q).slice(0, 120),
    saleId: UUID.test(saleId) ? saleId : "",
    sort: first(sp.sort) === "oldest" ? "oldest" : "newest",
    limit: (PAGE_SIZES as readonly number[]).includes(limit) ? limit : 50,
    offset: Number.isFinite(offset) && offset > 0 ? Math.min(offset, 100_000) : 0,
    record: UUID.test(record) ? record : null,
  };
}

/** Whether a search or filter narrows the list (the view tab and the order do not). */
export function hasDeliveriesFilters(filters: DeliveriesFilters): boolean {
  return Boolean(filters.q || filters.saleId);
}

/** What `GET /admin/deliveries` takes for these filters. */
export function deliveriesApiQuery(filters: DeliveriesFilters): URLSearchParams {
  const query = new URLSearchParams({
    view: filters.view,
    sort: filters.sort,
    limit: String(filters.limit),
    offset: String(filters.offset),
  });
  if (filters.q) query.set("q", filters.q);
  if (filters.saleId) query.set("saleId", filters.saleId);
  return query;
}

type Patch = Record<string, string | number | null | undefined>;

/**
 * The list URL with `patch` applied. Any change but the page starts again from the first page
 * and closes the panel; the defaults (Waiting for a price, newest first, 50 rows) keep it clean.
 */
export function deliveriesHref(current: DeliveriesSearch, patch: Patch): string {
  const next: Patch = { offset: null, [DELIVERY_RECORD_PARAM]: null, ...patch };
  if (next.view === "waiting") next.view = null;
  if (next.sort === "newest") next.sort = null;
  if (String(next.limit) === "50") next.limit = null;
  return buildListHref(DELIVERIES_PATH, current, next);
}

/** The list as it is, with a lot's panel open (or closed for null). */
export function deliveryPanelHref(current: DeliveriesSearch, lotId: string | null): string {
  return buildListHref(DELIVERIES_PATH, current, { [DELIVERY_RECORD_PARAM]: lotId });
}

/** The lot's record on Lot fulfilment, where dispatch, tracking and delivered are recorded. */
export function lotFulfilmentHref(lotId: string): string {
  return `/admin/lot-fulfilment?lot=${encodeURIComponent(lotId)}`;
}

/** `count` is left out when the counts did not load, so a failed read never shows zeros. */
export type DeliveryTab = {
  id: DeliveryStatus;
  label: string;
  href: string;
  count?: number;
  /** What the count means, read after it (", 3 waiting"), on the tab the sidebar counts. */
  countLabel?: string;
};

/** The six view tabs (TBL-6), each with how many deliveries it holds for the search and sale. */
export function deliveryTabs(
  current: DeliveriesSearch,
  counts: Record<DeliveryStatus, number> | null,
): DeliveryTab[] {
  return DELIVERY_STATUSES.map((id) => ({
    id,
    label: DELIVERIES_COPY.views[id],
    href: deliveriesHref(current, { view: id }),
    ...(counts ? { count: counts[id] } : {}),
    ...(counts && id === "waiting" ? { countLabel: DELIVERIES_COPY.waitingCountLabel } : {}),
  }));
}

const BADGE = DELIVERIES_COPY.badges;

/**
 * The badges, one table (CRF-7): the page never picks a tone. Words (from the copy file) and
 * shape carry the status as well as colour does.
 */
export const deliveryBadge = defineStatusMap<DeliveryBadgeKey>({
  waiting: { label: BADGE.waiting, tone: "warning", shape: "dot" },
  quoted: { label: BADGE.quoted, tone: "info", shape: "dot" },
  to_dispatch: { label: BADGE.to_dispatch, tone: "info", shape: "dot" },
  on_the_way: { label: BADGE.on_the_way, tone: "info", shape: "dot" },
  delivered: { label: BADGE.delivered, tone: "success", shape: "check" },
  withdrawn: { label: BADGE.withdrawn, tone: "neutral", shape: "ring" },
  cancelled: { label: BADGE.cancelled, tone: "neutral", shape: "ring" },
  collected: { label: BADGE.collected, tone: "neutral", shape: "ring" },
  awaiting_payment: { label: BADGE.awaiting_payment, tone: "neutral", shape: "ring" },
});

/** The status a row is keyed by: its view, or for a closed one, why it closed. */
function sinceKey(row: Pick<DeliveryView, "status" | "closedReason">): DeliverySinceKey {
  return row.status === "closed" ? (row.closedReason ?? "withdrawn") : row.status;
}

/** At most two badges a row: the status, and "Awaiting payment" on an unpaid booking. */
export function deliveryBadges(
  row: Pick<DeliveryView, "status" | "closedReason" | "awaitingPayment">,
): StatusPresentation[] {
  return [
    deliveryBadge(sinceKey(row)),
    ...(row.awaitingPayment ? [deliveryBadge("awaiting_payment")] : []),
  ];
}

/** "Lot 42 · Harbour at dusk", or the title alone for a lot without a number. */
export function deliveryLotTitle(lot: Pick<DeliveryView["lot"], "title" | "lotNumber">): string {
  return lot.lotNumber === null ? lot.title : DELIVERIES_COPY.lotTitle(lot.lotNumber, lot.title);
}

/** The sale and the day it closed: "Modern British · 12 Nov". */
export function deliverySaleLine(sale: DeliveryView["sale"], now: Date): string | null {
  return sale ? DELIVERIES_COPY.saleLine(sale.title, formatStaffDate(sale.endsAt, now)) : null;
}

/** "Paddle 118", when the buyer has one in the lot's sale. */
export function paddleLine(buyer: DeliveryView["buyer"]): string | null {
  return buyer.paddleNumber === null ? null : DELIVERIES_COPY.paddle(buyer.paddleNumber);
}

/** The buyer and their paddle on one line, as the panel header shows them. */
export function deliveryBuyerLine(buyer: DeliveryView["buyer"]): string {
  return DELIVERIES_COPY.buyerLine(buyer.name, paddleLine(buyer));
}

/** The quoted price, "£180.00", or null before a quote. */
export function deliveryPrice(row: Pick<DeliveryView, "quote">): string | null {
  return row.quote.amountMinor === null
    ? null
    : formatStaffMoney(row.quote.amountMinor, row.quote.currency);
}

/**
 * The "Waiting" column: how long the delivery has been where it is ("Asked 2 days ago"), or the
 * courier and tracking number once it is on the way. With no recorded time it names the step
 * alone ("Delivered"), never a time made up from the record's last edit.
 */
export function deliverySince(
  row: Pick<DeliveryView, "status" | "closedReason" | "statusSince" | "fulfilment">,
  now: Date,
): string {
  if (row.status === "on_the_way" && row.fulfilment) {
    const parts = [row.fulfilment.carrier, row.fulfilment.trackingNumber].filter(
      (part): part is string => Boolean(part),
    );
    if (parts.length > 0) return DELIVERIES_COPY.courierLine(parts);
  }
  const key = sinceKey(row);
  if (row.statusSince === null) return DELIVERIES_COPY.untimed[key];
  return DELIVERIES_COPY.since[key](formatStaffRelative(row.statusSince, now));
}

/** The exact London time behind the "Waiting" column, or that none is recorded. */
export function deliverySinceExact(row: Pick<DeliveryView, "statusSince">, now: Date): string {
  return row.statusSince === null
    ? DELIVERIES_COPY.timeNotRecorded
    : formatStaffDateTime(row.statusSince, now);
}

/** "1–50 of 312 deliveries". */
export function deliveriesRangeSummary(page: {
  offset: number;
  itemCount: number;
  total: number;
}): string {
  return DELIVERIES_COPY.range(
    page.offset + 1,
    page.offset + page.itemCount,
    formatStaffNumber(page.total),
    page.total,
  );
}

/** Previous and next links for the page the list is on, or null when it all fits on one. */
export function deliveriesPagination(
  current: DeliveriesSearch,
  page: { offset: number; limit: number; total: number; itemCount: number },
): { summary: string; prevHref: string | null; nextHref: string | null } | null {
  if (page.itemCount === 0) return null;
  const hasPrev = page.offset > 0;
  const hasNext = page.offset + page.itemCount < page.total;
  if (!hasPrev && !hasNext) return null;
  return {
    summary: deliveriesRangeSummary(page),
    prevHref: hasPrev
      ? deliveriesHref(current, {
          offset: page.offset - page.limit > 0 ? page.offset - page.limit : null,
        })
      : null,
    nextHref: hasNext ? deliveriesHref(current, { offset: page.offset + page.limit }) : null,
  };
}

export type DeliveriesFilterChip = { id: string; label: string; clearHref: string };

/** One removable chip per filter that is on (TBL-5). The search has its own field. */
export function deliveriesFilterChips(
  filters: DeliveriesFilters,
  current: DeliveriesSearch,
  sales: ReadonlyArray<{ id: string; title: string }>,
): DeliveriesFilterChip[] {
  if (!filters.saleId) return [];
  const title =
    sales.find((sale) => sale.id === filters.saleId)?.title ?? DELIVERIES_COPY.filters.unknownSale;
  return [
    {
      id: "sale",
      label: DELIVERIES_COPY.filters.saleChip(title),
      clearHref: deliveriesHref(current, { sale: null }),
    },
  ];
}

export type DeliveryTimelineEvent = {
  id: string;
  title: string;
  /** Null when nothing records when it happened; `noTime` says so instead. */
  at: string | null;
  noTime: string;
  actor: string;
  tone: "neutral" | "info" | "success" | "warning";
};

const EVENT_TONE: Record<DeliveryEvent["kind"], DeliveryTimelineEvent["tone"]> = {
  requested: "warning",
  quoted: "info",
  accepted: "info",
  withdrawn: "neutral",
  dispatched: "info",
  delivered: "success",
  collected: "neutral",
  cancelled: "neutral",
};

/**
 * The panel's Activity, newest first, each step with who took it. The API sends the history in
 * the order it happened (a step with no recorded time last, in its place), so this reverses it
 * rather than sorting by a time some steps do not have.
 */
export function deliveryTimeline(
  row: Pick<DeliveryView, "history" | "quote">,
): DeliveryTimelineEvent[] {
  return row.history
    .map((event, index) => ({
      id: `${event.kind}-${index}`,
      title:
        event.kind === "quoted" && row.quote.amountMinor !== null
          ? DELIVERIES_COPY.history.quotedOf(
              formatStaffMoney(row.quote.amountMinor, row.quote.currency),
            )
          : DELIVERIES_COPY.history[event.kind],
      at: event.at,
      noTime: DELIVERIES_COPY.timeNotRecorded,
      actor: DELIVERIES_COPY.actors[event.by],
      tone: EVENT_TONE[event.kind],
    }))
    .reverse();
}

/** Whether the buyer has paid for the lot, as the panel says it. */
export function deliveryPaidLine(row: Pick<DeliveryView, "fulfilment">, now: Date): string {
  const paidAt = row.fulfilment?.paidAt;
  if (paidAt) return DELIVERIES_COPY.panel.paidOn(formatStaffDate(paidAt, now));
  const paid = row.fulfilment && row.fulfilment.status !== "awaiting_payment";
  return paid ? DELIVERIES_COPY.panel.paidNoDate : DELIVERIES_COPY.panel.notPaid;
}

/** The phone row's meta line (TBL-16): "Example Trading Ltd · 12 Rue Exemple, Lyon · £180.00". */
export function deliveryPhoneMeta(
  row: Pick<DeliveryView, "buyer" | "destination" | "quote">,
): string {
  const price = deliveryPrice(row);
  return DELIVERIES_COPY.phoneMeta([row.buyer.name, row.destination, ...(price ? [price] : [])]);
}

/**
 * What the panel shows changing under it (D6 stale state): the delivery's status and its quote's.
 * Two snapshots that differ mean the buyer (or the courier) moved it on while it was open.
 */
export function deliveryStateKey(row: Pick<DeliveryView, "status" | "quote">): string {
  return `${row.status}:${row.quote.status}`;
}
