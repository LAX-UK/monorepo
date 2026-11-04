import type { PortalFavoritesHandlers } from "../handlers/portal-favorites.handler.js";
import type { FollowAlertsService } from "./follow-alerts.service.js";

/**
 * Adds the email alert to following an artist. Everything else about favourites is unchanged, and
 * the follow is answered whatever happens to the alert.
 */
export function createAlertingPortalFavorites(
  favorites: PortalFavoritesHandlers,
  alerts: Pick<FollowAlertsService, "onFollowed">,
): PortalFavoritesHandlers {
  return {
    ...favorites,
    async followArtist(identitySubjectId, artistSlug) {
      const outcome = await favorites.followArtist(identitySubjectId, artistSlug);
      if (outcome === "followed" || outcome === "already_followed") {
        await alerts.onFollowed(identitySubjectId, outcome);
      }
      return outcome;
    },
  };
}
