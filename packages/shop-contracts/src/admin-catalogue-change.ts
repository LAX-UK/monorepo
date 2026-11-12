import { type Static, Type } from "@sinclair/typebox";
import { AdminZohoLinkComparisonSchema } from "./admin-zoho-link.js";

/**
 * "Zoho changed since it was listed": the facts of a lax.art listing or a Bid lot that no longer
 * match the register record, which Zoho owns. Nothing here changes a copy by itself: a draft can
 * be brought up to date in one click, a published listing or a lot in a live or upcoming sale
 * never is, and staff decide.
 */

export const ADMIN_CATALOGUE_COPIES = ["lax_art", "bid_lot"] as const;
export const AdminCatalogueCopySchema = Type.Union(
  ADMIN_CATALOGUE_COPIES.map((copy) => Type.Literal(copy)),
);
export type AdminCatalogueCopy = Static<typeof AdminCatalogueCopySchema>;

export const AdminCatalogueChangeSchema = Type.Object({
  copy: AdminCatalogueCopySchema,
  /** A draft can follow Zoho in one click. Published and in a sale are decided by staff. */
  state: Type.Union([Type.Literal("draft"), Type.Literal("published"), Type.Literal("in_sale")]),
  /** The copy's value now (`laxArtValue`) and Zoho's (`zohoValue`) for each field; changed ones are flagged. */
  comparison: Type.Array(AdminZohoLinkComparisonSchema),
  /** True for a draft that can take Zoho's values; false when staff decide or the artist needs fixing first. */
  canUpdate: Type.Boolean(),
  /** In words: why this copy is not updated automatically, or what stops the update. Null for a draft that can update. */
  note: Type.Union([Type.String(), Type.Null()]),
});
export type AdminCatalogueChange = Static<typeof AdminCatalogueChangeSchema>;

export const AdminCatalogueUpdateBodySchema = Type.Object({ copy: AdminCatalogueCopySchema });
export type AdminCatalogueUpdateBody = Static<typeof AdminCatalogueUpdateBodySchema>;

export const AdminCatalogueUpdateResponseSchema = Type.Object({
  copy: AdminCatalogueCopySchema,
  /** Labels of the fields Zoho's values replaced; empty when the draft already matched. */
  updated: Type.Array(Type.String()),
});
export type AdminCatalogueUpdateResponse = Static<typeof AdminCatalogueUpdateResponseSchema>;
