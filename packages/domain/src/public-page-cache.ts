/*
 * Cache tags for the public LAX Bid sale and lot pages.
 *
 * The web app caches every session-free read behind those pages under the tag of the lot or sale
 * it shows. When the API or the worker commits a change that a visitor would see (a new price, a
 * status, a close time, a withdrawal, a catalogue edit) it asks the web app to drop the tags this
 * module names, so a cached page is never stale on what matters for bidding. The live bid state
 * itself never comes from the cache: the bid panel reads it from the socket and a no-store read.
 */

export const PUBLIC_CATALOGUE_LOTS_TAG = "catalogue-lots";
export const PUBLIC_CATALOGUE_SALES_TAG = "catalogue-sales";

const PUBLIC_ITEM_TAG = /^public-(lot|sale):[A-Za-z0-9_-]{1,64}$/;

/** The tag on every cached public read of one lot. */
export function publicLotCacheTag(lotId: string): string {
  return `public-lot:${lotId}`;
}

/** The tag on every cached public read of one sale, its catalogue pages included. */
export function publicSaleCacheTag(saleId: string): string {
  return `public-sale:${saleId}`;
}

/** True for a well-formed per-lot or per-sale tag. */
export function isPublicItemCacheTag(tag: string): boolean {
  return PUBLIC_ITEM_TAG.test(tag);
}

/**
 * A lot shows on its own page and on its sale's catalogue (card price, status, close time), so a
 * change to it drops both. This is what a bid or an extension drops: the site-wide lot lists keep
 * their short window rather than being emptied by every bid in a busy sale.
 */
export function publicPageTagsForLot(lot: { id: string; saleId?: string | null }): string[] {
  const tags = [publicLotCacheTag(lot.id)];
  if (lot.saleId) tags.push(publicSaleCacheTag(lot.saleId));
  return tags;
}

/** A sale's page lists its lots, so a sale change also drops the lot lists that show its dates. */
export function publicPageTagsForSale(saleId: string): string[] {
  return [publicSaleCacheTag(saleId), PUBLIC_CATALOGUE_SALES_TAG, PUBLIC_CATALOGUE_LOTS_TAG];
}

/**
 * The domain events that change what a public sale or lot page shows. Events about money,
 * consent, settlement or re-offers after the sale are private and change nothing public.
 */
export const PUBLIC_PAGE_LOT_EVENT_TYPES = [
  "lot.published",
  "lot.unpublished",
  "lot.activated",
  "lot.ended",
  "lot.cancelled",
  "lot.voided",
  "lot.attached_to_sale",
  "lot.detached_from_sale",
  "lot.soft_deleted",
  "lot.returned_to_inventory",
  "lot.reawarded",
] as const;

export const PUBLIC_PAGE_SALE_EVENT_TYPES = [
  "sale.published",
  "sale.unpublished",
  "sale.cancelled",
  "sale.rescheduled",
  "sale.ended",
  "sale.soft_deleted",
  "sale.test_flag_changed",
] as const;

export const PUBLIC_PAGE_EVENT_TYPES: readonly string[] = [
  ...PUBLIC_PAGE_LOT_EVENT_TYPES,
  ...PUBLIC_PAGE_SALE_EVENT_TYPES,
];

const LOT_EVENTS = new Set<string>(PUBLIC_PAGE_LOT_EVENT_TYPES);
const SALE_EVENTS = new Set<string>(PUBLIC_PAGE_SALE_EVENT_TYPES);

function stringField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The tags one committed domain event drops, or an empty list for an event no public page shows.
 * A lot moved between sales drops both sales (`fromSaleId`). Some lot events (a cancellation, a
 * withdrawal) carry no sale id; the caller passes the lot's current sale as `lotSaleId`.
 */
export function publicPageTagsForDomainEvent(
  event: { eventType: string; aggregateId: string; payload?: unknown },
  context: { lotSaleId?: string | null } = {},
): string[] {
  if (LOT_EVENTS.has(event.eventType)) {
    const tags = publicPageTagsForLot({
      id: event.aggregateId,
      saleId: stringField(event.payload, "saleId") ?? context.lotSaleId ?? null,
    });
    // A status change (published, ended, withdrawn) also changes which lists show the lot.
    tags.push(PUBLIC_CATALOGUE_LOTS_TAG);
    const from = stringField(event.payload, "fromSaleId");
    if (from) tags.push(publicSaleCacheTag(from));
    if (context.lotSaleId) tags.push(publicSaleCacheTag(context.lotSaleId));
    return [...new Set(tags)];
  }
  if (SALE_EVENTS.has(event.eventType)) {
    return publicPageTagsForSale(stringField(event.payload, "saleId") ?? event.aggregateId);
  }
  return [];
}

/** True when a lot event names no sale, so the caller should look up the lot's sale. */
export function publicPageLotEventNeedsSaleLookup(event: {
  eventType: string;
  payload?: unknown;
}): boolean {
  return LOT_EVENTS.has(event.eventType) && stringField(event.payload, "saleId") == null;
}
