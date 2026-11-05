import type { IZohoListingSourceReader } from "@auction/persistence/interfaces";

export type ListingTriggerEvent = { eventType: string; aggregateId?: string; payload: unknown };

type Resolve = (
  event: ListingTriggerEvent,
  sources: Pick<
    IZohoListingSourceReader,
    "registerIdsForLot" | "registerIdsForSale" | "registerIdsForLaxArtListing"
  >,
) => Promise<string[]>;

function field(payload: unknown, name: string): string | null {
  const value = (payload as Record<string, unknown> | null)?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

const ofRegister: Resolve = async (event) => {
  const id = field(event.payload, "registerId") ?? event.aggregateId ?? null;
  return id ? [id] : [];
};
const ofLot: Resolve = async (event, sources) =>
  event.aggregateId ? sources.registerIdsForLot(event.aggregateId) : [];
const ofSale: Resolve = async (event, sources) =>
  event.aggregateId ? sources.registerIdsForSale(event.aggregateId) : [];
/** A lot going on the block opens its sale, so every lot of that sale now reads live. */
const ofLotsSale: Resolve = async (event, sources) => {
  const saleId = field(event.payload, "saleId");
  if (saleId) return sources.registerIdsForSale(saleId);
  return ofLot(event, sources);
};
const ofLaxArtListing: Resolve = async (event, sources) =>
  event.aggregateId ? sources.registerIdsForLaxArtListing(event.aggregateId) : [];

/**
 * Which artworks each event can move, and so whose listing to refresh. The event only says that
 * something changed; the listing is always worked out from what LAX holds when it is handled.
 */
export const LISTING_TRIGGERS: Readonly<Record<string, Resolve>> = {
  "artwork_register.offer_changed": ofRegister,
  "shop.artwork.created": ofLaxArtListing,
  "shop.artwork.updated": ofLaxArtListing,
  "lot.created": ofLot,
  "lot.published": ofLot,
  "lot.unpublished": ofLot,
  "lot.attached_to_sale": ofLot,
  "lot.detached_from_sale": ofLot,
  "lot.cancelled": ofLot,
  "lot.voided": ofLot,
  "lot.ended": ofLot,
  "lot.returned_to_inventory": ofLot,
  "lot.activated": ofLotsSale,
  "sale.published": ofSale,
  "sale.unpublished": ofSale,
  "sale.ended": ofSale,
  "sale.cancelled": ofSale,
};

export const LISTING_TRIGGER_EVENT_TYPES = Object.keys(LISTING_TRIGGERS);

export async function registerIdsFor(
  event: ListingTriggerEvent,
  sources: Parameters<Resolve>[1],
): Promise<string[] | null> {
  const resolve = LISTING_TRIGGERS[event.eventType];
  return resolve ? resolve(event, sources) : null;
}
