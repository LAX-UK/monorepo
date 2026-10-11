import { type Static, Type } from "@sinclair/typebox";
import { PublicArtworkSalesChannelSchema } from "./artwork-public.js";

export const PortalSavedArtworkSchema = Type.Object({
  artworkSlug: Type.String({ minLength: 1 }),
  artworkTitle: Type.String({ minLength: 1 }),
  artistName: Type.String({ minLength: 1 }),
  artistSlug: Type.String({ minLength: 1 }),
  imageUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
  salesChannel: PublicArtworkSalesChannelSchema,
  savedAt: Type.String(),
});

export const PortalSavedArtworksResponseSchema = Type.Object({
  items: Type.Array(PortalSavedArtworkSchema),
});

export const PortalFollowedArtistSchema = Type.Object({
  artistSlug: Type.String({ minLength: 1 }),
  artistName: Type.String({ minLength: 1 }),
  portraitUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
  followedAt: Type.String(),
});

export const PortalFollowedArtistsResponseSchema = Type.Object({
  items: Type.Array(PortalFollowedArtistSchema),
});

/** Unknown slugs are 404 (`ShopApiErrorBody`), never a mutation status. */
export const PortalFavoriteMutationStatusSchema = Type.Union([
  Type.Literal("saved"),
  Type.Literal("already_saved"),
  Type.Literal("followed"),
  Type.Literal("already_followed"),
  Type.Literal("removed"),
  Type.Literal("already_removed"),
]);

export const PortalFavoriteMutationResponseSchema = Type.Object({
  status: PortalFavoriteMutationStatusSchema,
});

export type PortalSavedArtwork = Static<typeof PortalSavedArtworkSchema>;
export type PortalFollowedArtist = Static<typeof PortalFollowedArtistSchema>;
export type PortalFavoriteMutationStatus = Static<typeof PortalFavoriteMutationStatusSchema>;
export type PortalFavoriteMutationResponse = Static<typeof PortalFavoriteMutationResponseSchema>;
