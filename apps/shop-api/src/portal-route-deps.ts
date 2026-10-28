import type { PortalFavoritesHandlers } from "./application/handlers/portal-favorites.handler.js";
import type { LaxPortfolioHandlers } from "./application/lax-portfolio/lax-portfolio.handler.js";
import type { PortalArtistReader } from "./application/ports/portal-artist.reader.js";
import type {
  PortalOwnershipReader,
  PortalSalesReader,
} from "./application/ports/portal-ownership.reader.js";

/** Whether the person has applied to join the gallery, for the seller tools they are offered. */
export type ArtistApplicationPresence = { hasApplication(subject: string): Promise<boolean> };

export type PortalRoutesDeps = {
  portalOwnership: PortalOwnershipReader;
  portalSales: PortalSalesReader;
  portalArtist: PortalArtistReader;
  portalFavorites: PortalFavoritesHandlers;
  laxPortfolio: LaxPortfolioHandlers;
  artistApplications: ArtistApplicationPresence;
};
