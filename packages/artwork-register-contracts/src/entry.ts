import { z } from "zod";
import { OFFER_REF_KINDS, OFFER_STATES, type OfferRef, type OfferState } from "./offer-state.js";
import { STOCK_CODE_KINDS, STOCK_CODE_PATTERN } from "./stock-code.js";

/** The artist as the register records them. The code is the artist part of the stock code. */
export const artistRefSchema = z.object({
  zohoArtistId: z.string().min(1).nullable(),
  name: z.string().min(1),
  code: z.string().min(1),
});
export type ArtistRef = z.infer<typeof artistRefSchema>;

export const offerRefSchema = z.object({
  kind: z.enum(OFFER_REF_KINDS),
  id: z.string().min(1),
});

/**
 * One record per physical artwork, keyed to its Zoho CRM Product and its stock code. lax.art
 * listings, Bid lots and prints point at this record; it belongs to neither product.
 */
export const artworkRegisterEntrySchema = z.object({
  id: z.string().uuid(),
  zohoProductId: z.string().min(1),
  stockCode: z.string().regex(STOCK_CODE_PATTERN),
  kind: z.enum(STOCK_CODE_KINDS),
  /** For a print: the register id of the original it was made from. */
  sourceOriginalId: z.string().uuid().nullable(),
  title: z.string().min(1),
  artist: artistRefSchema,
  medium: z.string().nullable(),
  dimensions: z.string().nullable(),
  year: z.number().int().nullable(),
  /** Image references from Zoho (the Inventory item's pictures). */
  imageRefs: z.array(z.string().min(1)),
  /** The product Status as Zoho reports it (for example Available). */
  catalogueStatus: z.string().nullable(),
  /** Where the artwork is offered now. Owned by LAX. */
  offer: z.object({
    state: z.enum(OFFER_STATES),
    ref: offerRefSchema.nullable(),
  }),
  /** Zoho's modified time of the last change applied; older notices are ignored. */
  zohoModifiedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  /** Optimistic lock: every write names the version it read. */
  version: z.number().int().min(1),
});

export type ArtworkRegisterEntry = {
  id: string;
  zohoProductId: string;
  stockCode: string;
  kind: (typeof STOCK_CODE_KINDS)[number];
  sourceOriginalId: string | null;
  title: string;
  artist: ArtistRef;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  imageRefs: string[];
  catalogueStatus: string | null;
  offer: { state: OfferState; ref: OfferRef | null };
  zohoModifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

/** What a new register entry needs; the offer starts as held. */
export type NewArtworkRegisterEntry = Omit<
  ArtworkRegisterEntry,
  "id" | "offer" | "createdAt" | "updatedAt" | "version" | "zohoModifiedAt"
> & { zohoModifiedAt?: Date | null };
