import type {
  PortalFavoriteMutationStatus,
  PortalFollowedArtist,
  PortalSavedArtwork,
} from "@auction/shop-contracts";
import type { PortalFavoritesPort } from "../ports/portal-favorites.port.js";

export type PortalFavoriteMutationResult = PortalFavoriteMutationStatus | "not_found";

export type PortalFavoritesHandlers = {
  listSavedArtworks(identitySubjectId: string): Promise<PortalSavedArtwork[]>;
  saveArtwork(
    identitySubjectId: string,
    artworkSlug: string,
  ): Promise<PortalFavoriteMutationResult>;
  unsaveArtwork(
    identitySubjectId: string,
    artworkSlug: string,
  ): Promise<PortalFavoriteMutationResult>;
  listFollowedArtists(identitySubjectId: string): Promise<PortalFollowedArtist[]>;
  followArtist(
    identitySubjectId: string,
    artistSlug: string,
  ): Promise<PortalFavoriteMutationResult>;
  unfollowArtist(
    identitySubjectId: string,
    artistSlug: string,
  ): Promise<PortalFavoriteMutationResult>;
};

/** PUT/DELETE are idempotent: repeats succeed with `already_*`; only an unknown slug is `not_found`. */
export function createPortalFavoritesHandlers(port: PortalFavoritesPort): PortalFavoritesHandlers {
  return {
    listSavedArtworks: (subject) => port.listSavedArtworks(subject),
    listFollowedArtists: (subject) => port.listFollowedArtists(subject),

    async saveArtwork(subject, slug) {
      const outcome = await port.saveArtwork(subject, slug);
      return outcome === "artwork_not_found" ? "not_found" : outcome;
    },

    async unsaveArtwork(subject, slug) {
      const outcome = await port.unsaveArtwork(subject, slug);
      if (outcome === "artwork_not_found") return "not_found";
      return outcome === "not_saved" ? "already_removed" : "removed";
    },

    async followArtist(subject, slug) {
      const outcome = await port.followArtist(subject, slug);
      return outcome === "artist_not_found" ? "not_found" : outcome;
    },

    async unfollowArtist(subject, slug) {
      const outcome = await port.unfollowArtist(subject, slug);
      if (outcome === "artist_not_found") return "not_found";
      return outcome === "not_following" ? "already_removed" : "removed";
    },
  };
}
