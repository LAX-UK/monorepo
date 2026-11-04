import { type Static, Type } from "@sinclair/typebox";
import { CATALOGUE_SLUG_MAX_LENGTH, CATALOGUE_SLUG_PATTERN } from "./catalogue-slug.js";

/**
 * LAX Admin's "Offer on lax.art": staff turn an original from the From Zoho register into a
 * lax.art draft. The assessment says whether it can be done and what the dialog needs to show; the
 * offer creates the draft, linked to the register record, and returns the new artwork.
 */

const LinkTargetSchema = Type.Union([
  Type.Literal("lax_art_listing"),
  Type.Literal("bid_lot"),
  Type.Literal("private_sale"),
  Type.Literal("sold_place"),
  Type.Literal("zoho_record"),
  Type.Literal("open_sale"),
  Type.Literal("link_to_zoho"),
]);

/** Why the offer is refused, in words for staff, with the link that goes with it. */
export const AdminLaxArtOfferBlockerSchema = Type.Object({
  message: Type.String(),
  link: Type.Union([Type.Object({ label: Type.String(), target: LinkTargetSchema }), Type.Null()]),
});
export type AdminLaxArtOfferBlocker = Static<typeof AdminLaxArtOfferBlockerSchema>;

export const AdminLaxArtOfferMissingSchema = Type.Union([
  Type.Literal("image"),
  Type.Literal("size"),
  Type.Literal("medium"),
]);

export const AdminLaxArtOfferAssessmentSchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
  /** Zoho's facts, shown read-only in the dialog. */
  title: Type.String(),
  stockCode: Type.String(),
  artistName: Type.String(),
  artistCode: Type.String(),
  medium: Type.Union([Type.String(), Type.Null()]),
  dimensions: Type.Union([Type.String(), Type.Null()]),
  year: Type.Union([Type.Integer(), Type.Null()]),
  imageCount: Type.Integer({ minimum: 0 }),
  /** What Zoho still lacks. A draft can be made without it; publishing waits (see the page). */
  missing: Type.Array(AdminLaxArtOfferMissingSchema),
  /** The lax.art artist that carries Zoho's artist code; null when none does and staff choose one. */
  matchedArtist: Type.Union([
    Type.Object({ artistId: Type.String({ format: "uuid" }), displayName: Type.String() }),
    Type.Null(),
  ]),
  /** The listing already made from this record, when there is one. */
  existing: Type.Union([
    Type.Object({
      artworkId: Type.String({ format: "uuid" }),
      slug: Type.String(),
      published: Type.Boolean(),
    }),
    Type.Null(),
  ]),
  eligible: Type.Boolean(),
  /** Empty when the offer can go ahead. Most important first. */
  blockers: Type.Array(AdminLaxArtOfferBlockerSchema),
});
export type AdminLaxArtOfferAssessment = Static<typeof AdminLaxArtOfferAssessmentSchema>;

/** The two ways an original is sold on lax.art. There is no asking price. */
export const LAX_ART_OFFER_SALE_STATES = ["for_sale", "price_on_application"] as const;

export const AdminLaxArtOfferBodySchema = Type.Object({
  /** The lax.art artist. When Zoho's code is on no artist yet, it is saved on this one. */
  artistId: Type.String({ format: "uuid" }),
  saleState: Type.Union(LAX_ART_OFFER_SALE_STATES.map((state) => Type.Literal(state))),
  slug: Type.String({
    minLength: 1,
    maxLength: CATALOGUE_SLUG_MAX_LENGTH,
    pattern: CATALOGUE_SLUG_PATTERN,
  }),
});
export type AdminLaxArtOfferBody = Static<typeof AdminLaxArtOfferBodySchema>;

export const AdminLaxArtOfferResponseSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  /** False when the record already had its draft: asking again returns the same one. */
  created: Type.Boolean(),
});
export type AdminLaxArtOfferResponse = Static<typeof AdminLaxArtOfferResponseSchema>;

/** The lax.art listing made from a register record. */
export const AdminLaxArtListingSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  published: Type.Boolean(),
  createdAt: Type.String({ format: "date-time" }),
});
export type AdminLaxArtListing = Static<typeof AdminLaxArtListingSchema>;
