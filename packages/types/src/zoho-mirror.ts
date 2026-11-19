import type { DomainEventConsumer } from "./domain-event-catalog/types.js";

/**
 * The one place the Zoho mirror's vocabulary is written down: which consumer mirrors each kind of
 * record, which events it hears, and the skip reasons it leaves in the delivery ledger. The worker
 * writes these and LAX Admin's "Mirrored to Zoho" read interprets them, so both import them from
 * here and a rename cannot leave the reader quietly misreading the ledger.
 */

/** The records whose Zoho mirror staff can ask about. */
export type ZohoMirrorRecord = "order" | "artwork";

/** The delivery consumer whose ledger says whether each kind of record reached Zoho. */
export const ZOHO_MIRROR_CONSUMER = {
  order: "zoho_fulfilment",
  artwork: "zoho_artwork_writeback",
} as const satisfies Record<ZohoMirrorRecord, DomainEventConsumer>;

/**
 * The LAX listing on the artwork's Zoho Product (`ZOHO_ARTWORK_LISTING_MODE`), a second consumer
 * that writes to the same record. The artwork's "Mirrored to Zoho" read takes its outcome too.
 */
export const ZOHO_ARTWORK_LISTING_CONSUMER =
  "zoho_artwork_listing" as const satisfies DomainEventConsumer;

/** How a mirror runs: `off` does nothing, `dry_run` writes nothing to Zoho, `live` writes. */
export const ZOHO_MIRROR_MODES = ["off", "dry_run", "live"] as const;
export type ZohoMirrorMode = (typeof ZOHO_MIRROR_MODES)[number];

/** What a fulfilment mirror event is about: a print group, or an order. */
export type FulfilmentTriggerKind = "group" | "order";

/**
 * The events the fulfilment mirror (`zoho_fulfilment`) hears, and what each one is about. A table,
 * so a new event is one more line and nothing else changes.
 */
export const FULFILMENT_TRIGGER_KINDS: Readonly<Record<string, FulfilmentTriggerKind>> = {
  "shop.editions.allocated": "group",
  "shop.artwork.updated": "group",
  "shop.order.paid": "order",
  "shop.edition.sold": "order",
  "shop.edition.released": "order",
  "shop.fulfilment.dispatched": "order",
  "shop.fulfilment.status_changed": "order",
  "shop.print.pack_confirmed": "order",
  "shop.print.swapped": "order",
  "shop.framing.status_changed": "order",
};

/** The event types the fulfilment mirror handles for an order (each carries `orderId`). */
export const ORDER_MIRROR_EVENT_TYPES: readonly string[] = Object.entries(FULFILMENT_TRIGGER_KINDS)
  .filter(([, kind]) => kind === "order")
  .map(([eventType]) => eventType);

/**
 * The order events that set which prints are on the order: payment (raised with every print's
 * `shop.edition.sold`) and a swap. A print that cannot be mirrored fails these for staff; the
 * pick, dispatch and refund steps after them log it instead of failing the same order again, so
 * only a later good delivery of one of these shows the prints are now in Zoho.
 */
export const ORDER_EVENTS_THAT_SET_PRINTS: ReadonlySet<string> = new Set([
  "shop.order.paid",
  "shop.print.swapped",
]);

/** The events the artwork writeback (`zoho_artwork_writeback`) sends; each writes its own field. */
export const ARTWORK_WRITEBACK_EVENT = {
  /** Sends where the artwork is offered, as the Zoho Status. */
  offerChanged: "artwork_register.offer_changed",
  /** Sends the stock code. */
  stockCodeAssigned: "artwork_register.stock_code_assigned",
} as const;

/** Why the order mirror skipped an order's event; left in `last_error` of the skipped delivery. */
export const ORDER_MIRROR_SKIP = {
  orderNotFound: "order_not_found",
  orderNotPaid: "order_not_paid",
  noPrintsOnOrder: "no_prints_on_order",
  dryRun: "dry_run",
  alreadyInSync: "order_already_in_sync",
  /** Some prints still cannot be mirrored; the order already failed for staff. */
  printsNotMirrored: "order_prints_not_mirrored",
} as const;
export type OrderMirrorSkipReason = (typeof ORDER_MIRROR_SKIP)[keyof typeof ORDER_MIRROR_SKIP];

/** Why the artwork writeback skipped an event; left in `last_error` of the skipped delivery. */
export const ARTWORK_WRITEBACK_SKIP = {
  writebackOff: "writeback_off",
  payloadWithoutRegisterId: "payload_without_register_id",
  eventTypeNotHandled: "event_type_not_handled",
  registerEntryMissing: "register_entry_missing",
  printGroupNotAProduct: "print_group_not_a_product",
  dryRun: "dry_run",
  statusAlreadyInSync: "status_already_in_sync",
  stockCodeAlreadyInSync: "stock_code_already_in_sync",
  /** Zoho's Status disagrees with LAX and staff were told; nothing was written. */
  statusConflictRaised: "status_conflict_raised",
  /** Zoho holds a stock code LAX did not write and staff were told; nothing was written. */
  stockCodeConflictRaised: "stock_code_conflict_raised",
  /** A gallery sale is Zoho's: LAX never writes Sold back over a Status staff changed. */
  gallerySaleOwnedByZoho: "gallery_sale_owned_by_zoho",
} as const;
export type ArtworkWritebackSkipReason =
  (typeof ARTWORK_WRITEBACK_SKIP)[keyof typeof ARTWORK_WRITEBACK_SKIP];

/**
 * The listing consumer's events that LAX Admin can tie to one artwork from the register alone: the
 * one raised on the register entry, and those raised on the lax.art listing it is offered through
 * or was drafted into. Lot and sale events are fanned out to artworks through LAX Bid's tables,
 * which LAX Shop does not read, so the read leaves them to Failed jobs and the nightly Last check.
 */
export const ARTWORK_LISTING_EVENT = {
  onRegister: ["artwork_register.offer_changed"],
  onLaxArtListing: ["shop.artwork.created", "shop.artwork.updated"],
} as const;

/** Why the listing consumer skipped an event; left in `last_error` of the skipped delivery. */
export const ARTWORK_LISTING_SKIP = {
  eventTypeNotHandled: "event_type_not_handled",
  noRegisterEntry: "no_register_entry",
  notAnOriginal: "not_an_original",
  dryRun: "dry_run",
  listingAlreadyInSync: "listing_already_in_sync",
  /** Zoho already shows a listing newer than the facts read; nothing was written. */
  newerListingInZoho: "newer_listing_in_zoho",
} as const;
export type ArtworkListingSkipReason =
  (typeof ARTWORK_LISTING_SKIP)[keyof typeof ARTWORK_LISTING_SKIP];
