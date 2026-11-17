import type { DeliveryStatus } from "@auction/domain";

/**
 * Every word on the staff Deliveries screen (docs/design/staff-gaps-delivery-zoho-alerts.md,
 * D2–D6), in one place. Tables keyed by the domain's own unions fail the build when a new status
 * has no words yet.
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
  /** Said after the count on the Waiting tab and the sidebar: "3, 3 waiting". */
  waitingCountLabel: (count: number) => `${count} waiting`,
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
    cancelled: (relative: string) => `Cancelled ${relative}`,
  },
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
    fallbackTitle: "Delivery",
    openFulfilment: "Open lot fulfilment",
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
    activity: "Activity",
    activityLabel: "Delivery activity",
    noActivity: "Nothing has happened yet.",
    notFound: "This delivery could not be found. It may have been withdrawn.",
  },
  /** One line per step in the Activity timeline. */
  history: {
    requested: "Buyer asked for a delivery price",
    quoted: "LAX sent a quote",
    accepted: "Buyer accepted the quote",
    withdrawn: "Buyer withdrew the request",
    dispatched: "Handed to the courier",
    delivered: "Delivered",
    cancelled: "Sale cancelled",
  },
  actors: { buyer: "Buyer", staff: "LAX" },
} as const;
