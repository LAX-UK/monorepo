import { type Static, Type } from "@sinclair/typebox";

export const ADMIN_LOOKUP_SEARCH_MAX_LENGTH = 100;
export const ADMIN_LOOKUP_MAX_LIMIT = 25;

/** What staff type into a picker; matches by name (and email, for people). */
export const AdminLookupQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ maxLength: ADMIN_LOOKUP_SEARCH_MAX_LENGTH })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: ADMIN_LOOKUP_MAX_LIMIT })),
});
export type AdminLookupQuery = Static<typeof AdminLookupQuerySchema>;

export const AdminPartyLookupItemSchema = Type.Object({
  partyId: Type.String({ format: "uuid" }),
  displayName: Type.String(),
  kind: Type.String(),
  /** From the person's profile; null for a gallery or a person without one. */
  email: Type.Union([Type.String(), Type.Null()]),
});
export const AdminPartyLookupSchema = Type.Object({
  items: Type.Array(AdminPartyLookupItemSchema),
});
export type AdminPartyLookupItem = Static<typeof AdminPartyLookupItemSchema>;

export const AdminArtworkLookupItemSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  title: Type.String(),
  artistName: Type.String(),
});
export const AdminArtworkLookupSchema = Type.Object({
  items: Type.Array(AdminArtworkLookupItemSchema),
});
export type AdminArtworkLookupItem = Static<typeof AdminArtworkLookupItemSchema>;

export const AdminEditionLookupItemSchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  artistName: Type.String(),
  editionNumber: Type.Integer(),
  listingStatus: Type.String(),
});
export const AdminEditionLookupSchema = Type.Object({
  items: Type.Array(AdminEditionLookupItemSchema),
});
export type AdminEditionLookupItem = Static<typeof AdminEditionLookupItemSchema>;
