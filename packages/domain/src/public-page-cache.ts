import { WEB_PUBLIC_CACHE_EVENT_TYPES } from "@auction/types";

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

const BROAD_TAGS: ReadonlySet<string> = new Set([
  PUBLIC_CATALOGUE_LOTS_TAG,
  PUBLIC_CATALOGUE_SALES_TAG,
]);

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

/** True for any tag the web revalidate route accepts: a lot, a sale, or one of the two lists. */
export function isPurgeablePublicCacheTag(tag: string): boolean {
  return BROAD_TAGS.has(tag) || PUBLIC_ITEM_TAG.test(tag);
}

/**
 * A lot's catalogue content shows on its own page and on its sale's catalogue (card title, image,
 * estimate, schedule, lot navigation), so a change to it drops both. Staff edits, lot events and a
 * lot's end drop this.
 */
export function publicPageTagsForLot(lot: { id: string; saleId?: string | null }): string[] {
  const tags = [publicLotCacheTag(lot.id)];
  if (lot.saleId) tags.push(publicSaleCacheTag(lot.saleId));
  return tags;
}

/**
 * What an accepted bid or an extension drops: the lot alone. The price, the close time and the
 * history never come from the cached render (the page and the catalogue cards read them live), so
 * nothing sale-level changes, and a busy sale's catalogue is not emptied by every bid.
 */
export function publicPageTagsForBid(lot: { id: string }): string[] {
  return [publicLotCacheTag(lot.id)];
}

/** A sale's page lists its lots, so a sale change also drops the lot lists that show its dates. */
export function publicPageTagsForSale(saleId: string): string[] {
  return [publicSaleCacheTag(saleId), PUBLIC_CATALOGUE_SALES_TAG, PUBLIC_CATALOGUE_LOTS_TAG];
}

/**
 * The domain events that change what a public sale or lot page shows. Events about money,
 * consent, settlement or re-offers after the sale are private and change nothing public. The list
 * is the catalog's own (`WEB_PUBLIC_CACHE_EVENT_TYPES`, which routes them to the worker's
 * `web_public_cache` projector), split by aggregate, so the two cannot drift.
 */
export const PUBLIC_PAGE_EVENT_TYPES: readonly string[] = WEB_PUBLIC_CACHE_EVENT_TYPES;

export const PUBLIC_PAGE_LOT_EVENT_TYPES: readonly string[] = PUBLIC_PAGE_EVENT_TYPES.filter((t) =>
  t.startsWith("lot."),
);

export const PUBLIC_PAGE_SALE_EVENT_TYPES: readonly string[] = PUBLIC_PAGE_EVENT_TYPES.filter((t) =>
  t.startsWith("sale."),
);

const LOT_EVENTS = new Set<string>(PUBLIC_PAGE_LOT_EVENT_TYPES);
const SALE_EVENTS = new Set<string>(PUBLIC_PAGE_SALE_EVENT_TYPES);

function stringField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringListField(payload: unknown, key: string): string[] {
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
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
    const tags = publicPageTagsForSale(stringField(event.payload, "saleId") ?? event.aggregateId);
    // Lots put back on the sale's premium show new terms on their own pages.
    for (const lotId of stringListField(event.payload, "lot_ids")) {
      tags.push(publicLotCacheTag(lotId));
    }
    return [...new Set(tags)];
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
