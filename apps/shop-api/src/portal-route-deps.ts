import type { PortalFavoritesHandlers } from "./application/handlers/portal-favorites.handler.js";
import type { PortalArtistReader } from "./application/ports/portal-artist.reader.js";
import type {
  PortalOwnershipReader,
  PortalSalesReader,
} from "./application/ports/portal-ownership.reader.js";

export type PortalRoutesDeps = {
  portalOwnership: PortalOwnershipReader;
  portalSales: PortalSalesReader;
  portalArtist: PortalArtistReader;
  portalFavorites: PortalFavoritesHandlers;
};
