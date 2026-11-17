import type { DeliveryStatus } from "@auction/domain";

/** The badge each row can carry: its status (closed says why) and "Awaiting payment". */
export type DeliveryBadgeKey =
  | Exclude<DeliveryStatus, "closed">
  | "withdrawn"
  | "declined"
  | "cancelled"
  | "collected"
  | "awaiting_payment";

/** What the "Waiting" column and the badge key a closed delivery by: why it closed. */
export type DeliverySinceKey = Exclude<DeliveryBadgeKey, "awaiting_payment">;

/**
 * Every word on the staff Deliveries screen (docs/design/staff-gaps-delivery-zoho-alerts.md,
 * D2–D6), in one place. Tables keyed by the domain's own unions fail the build when a new status
 * has no words yet.
 */
export const DELIVERIES_COPY = {
  title: "Deliveries",
  description: "Won lots that buyers want delivered, from the price they asked for to their door.",
  listLabel: "Deliveries",
  /** The thumbnail's name for a lot with no photo yet. */
  noPhoto: "No photo yet",
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
   * Said after the count on the Waiting for a price tab, as the sidebar says it (NAV-3): "3,
   * 3 waiting".
   */
  waitingCountLabel: "waiting",
  /** The status badges (D2): words, not colour alone. */
  badges: {
    waiting: "Waiting for a price",
    quoted: "Quote sent",
    to_dispatch: "Booked, not dispatched",
    on_the_way: "On the way",
    delivered: "Delivered",
    withdrawn: "Withdrawn by buyer",
    declined: "Declined by LAX",
    cancelled: "Cancelled",
    collected: "Collected in person",
    awaiting_payment: "Awaiting payment",
  } satisfies Record<DeliveryBadgeKey, string>,
  /** "Lot 42 · Harbour at dusk". */
  lotTitle: (lotNumber: number, title: string) => `Lot ${lotNumber} · ${title}`,
  /** "Paddle 118". */
  paddle: (paddleNumber: number) => `Paddle ${paddleNumber}`,
  /** "Modern British · Thu 12 Nov". */
  saleLine: (sale: string, closed: string) => `${sale} · ${closed}`,
  /** "Example Trading Ltd · Paddle 118". */
  buyerLine: (name: string, paddle: string | null) => (paddle ? `${name} · ${paddle}` : name),
  /** The phone row's one meta line, its parts joined. */
  phoneMeta: (parts: readonly string[]) => parts.join(" · "),
  /** The courier and tracking number, in the Waiting column once on the way. */
  courierLine: (parts: readonly string[]) => parts.join(" · "),
  /** "1–50 of 312 deliveries". */
  range: (from: number, to: number, total: string, count: number) =>
    `${from}–${to} of ${total} ${count === 1 ? "delivery" : "deliveries"}`,
  /** What the queue panel steps through, singular: "Next delivery". */
  queueNoun: "delivery",
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
  /** The "Waiting" column: how long the delivery has been where it is. */
  since: {
    waiting: (relative: string) => `Asked ${relative}`,
    quoted: (relative: string) => `Quoted ${relative}`,
    to_dispatch: (relative: string) => `Accepted ${relative}`,
    on_the_way: (relative: string) => `Dispatched ${relative}`,
    delivered: (relative: string) => `Delivered ${relative}`,
    withdrawn: (relative: string) => `Withdrawn ${relative}`,
    declined: (relative: string) => `Declined ${relative}`,
    cancelled: (relative: string) => `Cancelled ${relative}`,
    collected: (relative: string) => `Collected ${relative}`,
  } satisfies Record<DeliverySinceKey, (relative: string) => string>,
  /**
   * The same column when no recorded time says when (dispatch, delivery and cancellation keep
   * none): the step alone, never a made-up time.
   */
  untimed: {
    waiting: "Asked",
    quoted: "Quoted",
    to_dispatch: "Accepted",
    on_the_way: "Dispatched",
    delivered: "Delivered",
    withdrawn: "Withdrawn",
    declined: "Declined",
    cancelled: "Cancelled",
    collected: "Collected",
  } satisfies Record<DeliverySinceKey, string>,
  /** Said where a time would be, when none is recorded. */
  timeNotRecorded: "Time not recorded",
  search: {
    label: "Search deliveries",
    placeholder: "Search lot, paddle, buyer or destination",
  },
  filters: {
    title: "Filter deliveries",
    description: "Where a delivery stands is set by the tabs above the list.",
    sale: "Sale",
    saleChip: (title: string) => `Sale: ${title}`,
    anySale: "Any sale",
    unknownSale: "Unknown sale",
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
    /** The route error page's way back. */
    back: "Back to deliveries",
  },
  /**
   * The Bid API refused the read although the page let the person in (the two disagree on a
   * role): the kit's access-denied state, since trying again cannot help.
   */
  denied: {
    resource: "Deliveries",
    roles: ["Fulfilment", "Administrator"],
  },
  rowActions: {
    label: (lot: string) => `Actions for ${lot}`,
    open: "Open details",
    fulfilment: "Open lot fulfilment",
    copyLot: "Copy lot number",
    lotNumber: "Lot number",
  },
  panel: {
    fallbackTitle: "Delivery",
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
      /** A declined request: what the buyer was told. */
      declineReason: "Reason given to the buyer",
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
    /** D6: the lot in the URL has no delivery request (a withdrawn one is still found). */
    notFound: {
      title: "This delivery could not be found",
      description: "No buyer has asked for delivery on this lot, or the link is out of date.",
      back: "Back to the list",
    },
    /** D6 error: the lot's delivery could not be read; it may well exist. */
    loadError: {
      title: "This delivery could not be loaded. Try again.",
      description: "The Bid API didn't answer. The buyer's request is kept.",
      retry: "Try again",
      back: "Back to the list",
    },
    /** D6: the request moved on while its panel was open. */
    changed: {
      title: "The buyer changed this request while you were looking at it.",
      description: "Check it again before you act on it.",
    },
  },
  /** One line per step in the Activity timeline. */
  history: {
    requested: "Buyer asked for a delivery price",
    quoted: "LAX sent a quote",
    quotedOf: (price: string) => `LAX sent a quote of ${price}`,
    accepted: "Buyer accepted the quote",
    withdrawn: "Buyer withdrew the request",
    /** A `withdrawn` step the team took ("Can't deliver", D8). */
    declined: "Declined by LAX",
    dispatched: "Handed to the courier",
    delivered: "Delivered",
    collected: "Buyer collected it in person",
    cancelled: "Purchase cancelled",
  },
  actors: { buyer: "Buyer", staff: "LAX" },
  /**
   * "Can't deliver" (D5, D8): the footer action in Waiting for a price and Quote sent, and its
   * dialog. The reason is emailed to the buyer as written.
   */
  decline: {
    action: "Can't deliver",
    title: (lot: string) => `Can't deliver ${lot}?`,
    description:
      "The buyer is emailed your reason and the request closes. They can still collect the lot, or ask for delivery to another address.",
    reasonLabel: "Reason for the buyer",
    reasonHint: (max: number) => `Sent to the buyer as you write it. Up to ${max} characters.`,
    /** The API's own message for an empty reason. */
    reasonMissing: "Tell the buyer why you can't deliver",
    reasonTooLong: (max: number) => `Use ${max} characters or fewer`,
    submit: "Decline and email the buyer",
    /** Saved (D6): "Declined the delivery request for Lot 42 · Harbour at dusk". */
    declinedToast: (lot: string) => `Declined the delivery request for ${lot}`,
    cancel: "Cancel",
    /** D6 stale state: the request moved on while the dialog was open. */
    stale: {
      title: "This request changed while you had it open.",
      description: "Check it and try again. Nothing was sent to the buyer.",
    },
    failedTitle: "The request couldn't be declined",
    errors: {
      forbidden: "You don't have permission to decline delivery requests.",
      notFound: "This lot no longer has a buyer. Nothing was sent.",
      invalid: "Check the reason and try again.",
      unavailable:
        "The Bid API didn't answer. Nothing was sent to the buyer. Try again in a moment.",
    },
  },
} as const;
