import type { PortalFollowedArtist, PortalSavedArtwork } from "@auction/shop-contracts";

export type SaveArtworkOutcome = "saved" | "already_saved" | "artwork_not_found";
export type UnsaveArtworkOutcome = "removed" | "not_saved" | "artwork_not_found";
export type FollowArtistOutcome = "followed" | "already_followed" | "artist_not_found";
export type UnfollowArtistOutcome = "removed" | "not_following" | "artist_not_found";

/** Favorites are keyed by identity subject; identity merges re-key rows in the merge-inbox runner. */
export interface PortalFavoritesPort {
  listSavedArtworks(identitySubjectId: string): Promise<PortalSavedArtwork[]>;
  saveArtwork(identitySubjectId: string, artworkSlug: string): Promise<SaveArtworkOutcome>;
  unsaveArtwork(identitySubjectId: string, artworkSlug: string): Promise<UnsaveArtworkOutcome>;
  listFollowedArtists(identitySubjectId: string): Promise<PortalFollowedArtist[]>;
  followArtist(identitySubjectId: string, artistSlug: string): Promise<FollowArtistOutcome>;
  unfollowArtist(identitySubjectId: string, artistSlug: string): Promise<UnfollowArtistOutcome>;
}
