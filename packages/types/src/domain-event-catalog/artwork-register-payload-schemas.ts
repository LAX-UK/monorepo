import { z } from "zod";

const OFFER_STATE = z.enum(["held", "lax_art", "bid_sale", "private_sale", "sold", "withdrawn"]);

/**
 * An artwork moved to a new place (or back to the held state). The Zoho writeback reads the
 * register for the current state rather than trusting this one, so a late or repeated event never
 * writes an old value.
 */
export const artworkRegisterOfferChangedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  registerId: z.string().uuid(),
  zohoProductId: z.string().min(1),
  stockCode: z.string().min(1),
  fromState: OFFER_STATE,
  toState: OFFER_STATE,
});
export type ArtworkRegisterOfferChangedPayloadV1 = z.infer<
  typeof artworkRegisterOfferChangedPayloadSchemaV1
>;

/** LAX issued a stock code to an artwork on the register. */
export const artworkRegisterStockCodeAssignedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  registerId: z.string().uuid(),
  zohoProductId: z.string().min(1),
  stockCode: z.string().min(1),
});
export type ArtworkRegisterStockCodeAssignedPayloadV1 = z.infer<
  typeof artworkRegisterStockCodeAssignedPayloadSchemaV1
>;

const CATALOGUE_FIELD = z.enum(["title", "artist", "medium", "dimensions", "year", "imageRefs"]);

/**
 * Zoho changed catalogue facts of an artwork on the register: the fields that changed, with the
 * value before and after for each. The register already holds the new values; lax.art listings and
 * Bid lots made from the record do not follow by themselves, so staff are shown the difference and
 * decide. Catalogue facts only: no personal data.
 */
export const artworkRegisterCatalogueChangedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  registerId: z.string().uuid(),
  zohoProductId: z.string().min(1),
  stockCode: z.string().min(1),
  fields: z.array(CATALOGUE_FIELD).min(1),
  changes: z.record(CATALOGUE_FIELD, z.object({ from: z.unknown(), to: z.unknown() })),
});
export type ArtworkRegisterCatalogueChangedPayloadV1 = z.infer<
  typeof artworkRegisterCatalogueChangedPayloadSchemaV1
>;

/**
 * Why an artwork's location reads differently: it was `moved`, or the location it is at was
 * changed on the list (renamed or its note edited, retired, or brought back). A list change is
 * published once per artwork at that location, so a reader of one artwork needs nothing else.
 */
export const ARTWORK_LOCATION_CHANGE_REASONS = [
  "moved",
  "location_updated",
  "location_retired",
  "location_restored",
] as const;

/**
 * An artwork's physical location changed, or how it reads did (not where it is offered: that is
 * `offer_changed`). Ids only: location names are typed by staff and could name a person ("On loan
 * to ..."), so a reader looks the location up. The Zoho mirror reads the register's current
 * location rather than trusting this one, so a late or repeated event never writes an old value.
 * A move goes from one location to another; a list change names the same location twice.
 */
export const artworkRegisterLocationChangedPayloadSchemaV1 = z
  .object({
    schemaVersion: z.literal(1),
    registerId: z.string().uuid(),
    zohoProductId: z.string().min(1),
    stockCode: z.string().min(1),
    reason: z.enum(ARTWORK_LOCATION_CHANGE_REASONS),
    /** Null when the artwork had no location recorded before this move. */
    fromLocationId: z.string().uuid().nullable(),
    toLocationId: z.string().uuid(),
  })
  .refine(
    (payload) =>
      payload.reason === "moved"
        ? payload.fromLocationId !== payload.toLocationId
        : payload.fromLocationId === payload.toLocationId,
    { message: "a move changes location; a list change keeps it" },
  );
export type ArtworkRegisterLocationChangedPayloadV1 = z.infer<
  typeof artworkRegisterLocationChangedPayloadSchemaV1
>;
