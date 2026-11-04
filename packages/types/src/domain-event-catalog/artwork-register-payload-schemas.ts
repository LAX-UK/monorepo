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
