import type { DeliveryClosedReason, DeliveryStatus } from "@auction/domain";

/** A delivery's badge: its status, a closed one's reason, or "Awaiting payment" beside it. */
export type DeliveryBadgeKey =
  | Exclude<DeliveryStatus, "closed">
  | DeliveryClosedReason
  | "awaiting_payment";

/** One step in a delivery's history, as the API names it. */
export type DeliveryEventKind =
  | "requested"
  | "quoted"
  | "accepted"
  | "withdrawn"
  | "dispatched"
  | "delivered"
  | "collected"
  | "cancelled";

/**
 * Every word on the staff Deliveries screen (docs/design/staff-gaps-delivery-zoho-alerts.md,
 * D2–D6), in one place. Tables keyed by the domain's own unions fail the build when a new status
 * has no words yet. `deliveries-copy.test.ts` fails on a key nothing reads.
 */
export const DELIVERIES_COPY = {
  title: "Deliveries",
  description: "Won lots that buyers want delivered, from the price they asked for to their door.",
  listLabel: "Deliveries",
  meta: {
    title: "Deliveries",
    description: "Courier quotes buyers asked for on won lots, from the price to their door.",
  },
  views: {
    waiting: "Waiting for a price",
    quoted: "Quoted",
    to_dispatch: "To dispatch",
    on_the_way: "On the way",
    delivered: "Delivered",
    closed: "Closed",
  } satisfies Record<DeliveryStatus, string>,
  /**
   * Read after the Waiting for a price tab's count, as the sidebar's count is read (NAV-3):
   * "Waiting for a price, 3 waiting".
   */
  waitingCountLabel: "waiting",
  /** D2: the words on each badge. The tone and shape are in `deliveryBadge`. */
  badges: {
    waiting: "Waiting for a price",
    quoted: "Quote sent",
    to_dispatch: "Booked, not dispatched",
    on_the_way: "On the way",
    delivered: "Delivered",
    withdrawn: "Withdrawn by buyer",
    cancelled: "Cancelled",
    collected: "Collected in person",
    awaiting_payment: "Awaiting payment",
  } satisfies Record<DeliveryBadgeKey, string>,
  /** "Lot 42 · Harbour at dusk". */
  lotTitle: (lotNumber: number, title: string) => `Lot ${lotNumber} · ${title}`,
  /** The buyer's paddle in the lot's sale. */
  paddle: (paddleNumber: number) => `Paddle ${paddleNumber}`,
  /** One line of facts: "Modern British · 12 Nov". */
  join: (parts: readonly string[]) => parts.join(" · "),
  columns: {
    lot: "Lot",
    buyer: "Buyer",
    destination: "Destination",
    status: "Status",
    price: "Price",
    waiting: "Waiting",
    /** The phone layout's one meta line. */
    summary: "Buyer, destination and price",
  },
  /** The "Waiting" column: what last happened to the delivery ("Asked 2 days ago"). */
  since: {
    waiting: "Asked",
    quoted: "Quoted",
    to_dispatch: "Accepted",
    on_the_way: "Dispatched",
    delivered: "Delivered",
    withdrawn: "Withdrawn",
    cancelled: "Cancelled",
    collected: "Collected",
  } satisfies Record<Exclude<DeliveryStatus, "closed"> | DeliveryClosedReason, string>,
  /** "Asked 2 days ago". Without a recorded time, the step alone ("Dispatched"). */
  sinceAt: (step: string, relative: string) => `${step} ${relative}`,
  /** "1–50 of 312 deliveries". */
  range: (from: string, to: string, total: string, count: number) =>
    `${from}–${to} of ${total} ${count === 1 ? "delivery" : "deliveries"}`,
  /** What the queue holds, for "Next delivery" (J). */
  queueNoun: "delivery",
  search: {
    label: "Search deliveries",
    placeholder: "Search lot, paddle, buyer or destination",
  },
  filters: {
    title: "Filter deliveries",
    description: "Where a delivery stands is set by the tabs above the list.",
    sale: "Sale",
    anySale: "Any sale",
    unknownSale: "Unknown sale",
    /** The sale filter's chip: "Sale: Modern British". */
    saleChip: (title: string) => `Sale: ${title}`,
    order: "Order",
    newest: "Newest first",
    oldest: "Waiting longest first",
  },
  empty: {
    waiting: {
      title: "No buyers are waiting for a delivery price",
      description: "When a buyer asks for delivery on a won lot, it appears here.",
    },
    quoted: {
      title: "No quotes waiting for a buyer",
      description: "Quotes you send appear here until the buyer accepts or withdraws.",
    },
    to_dispatch: {
      title: "Nothing to dispatch",
      description: "Accepted deliveries appear here until the courier collects them.",
    },
    on_the_way: { title: "No deliveries on the way", description: undefined },
    delivered: { title: "Nothing delivered yet", description: undefined },
    closed: { title: "No closed quotes", description: undefined },
  } satisfies Record<DeliveryStatus, { title: string; description: string | undefined }>,
  noResultsNoun: "deliveries",
  error: {
    title: "Deliveries could not be loaded. Try again.",
    unavailable: "The Bid API didn't answer. Buyers' requests are kept; try again in a moment.",
    forbidden: "You do not have access to deliveries.",
  },
  rowActions: {
    label: (lot: string) => `Actions for ${lot}`,
    open: "Open details",
    fulfilment: "Open lot fulfilment",
    copyLot: "Copy lot number",
    lotNumber: "Lot number",
  },
  panel: {
    meta: { buyer: "Buyer", sale: "Sale", asked: "Asked" },
    summary: {
      destination: "Destination",
      size: "Size as catalogued",
      hammer: "Hammer price",
      paid: "Paid",
    },
    paidOn: (date: string) => `Yes, ${date}`,
    paidNoDate: "Yes",
    notPaid: "Not yet",
    quote: {
      title: "Quote",
      price: "Price",
      note: "Note to the buyer",
      quoted: "Quoted",
      none: "Not priced yet.",
    },
    delivery: {
      title: "Delivery",
      method: "Method",
      carrier: "Carrier",
      tracking: "Tracking",
      fulfilment: "Lot fulfilment",
      shipping: "Courier",
      collection: "Collection",
      notStarted: "Not started",
    },
    activityLabel: "Delivery activity",
    noActivity: "Nothing has happened yet.",
    /** In place of the time for a step that keeps none (dispatch, delivery, cancellation). */
    undated: "Time not recorded",
    /** D6: the lot in the address has no delivery (withdrawn and gone, or a wrong link). */
    notFound: {
      title: "Delivery not found",
      notice: "This delivery could not be found. It may have been withdrawn.",
      back: "Back to the list",
    },
    /** D6: the delivery moved on while its panel was open (the buyer withdrew or accepted). */
    changed: {
      title: "The buyer changed this request while you had it open.",
      body: "It now shows where it stands. Check it before you act on it.",
    },
  },
  /** One line per step in the Activity timeline. */
  history: {
    requested: "Buyer asked for a delivery price",
    quoted: "LAX sent a quote",
    accepted: "Buyer accepted the quote",
    withdrawn: "Buyer withdrew the request",
    dispatched: "Handed to the courier",
    delivered: "Delivered",
    collected: "Buyer collected it in person",
    cancelled: "Purchase cancelled",
  } satisfies Record<DeliveryEventKind, string>,
  /** "LAX sent a quote of £180.00". */
  historyQuoted: (price: string) => `LAX sent a quote of ${price}`,
  actors: { buyer: "Buyer", staff: "LAX" },
} as const;
