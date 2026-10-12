import {
  fetchArtChannelArtistBySlug,
  fetchArtChannelArtists,
  fetchArtChannelArtworkBySlug,
  fetchArtChannelArtworks,
  fetchArtChannelCategories,
} from "@/lib/art-catalogue.server";
import { artIdentityUrl } from "@/lib/art-identity.server";
import {
  fetchPortalCollection,
  fetchPortalEnquiries,
  fetchPortalFollowedArtists,
  fetchPortalGeneralEnquiries,
  fetchPortalPayeeConnect,
  fetchPortalSavedArtworks,
} from "@/lib/art-portal.server";
import { isArtPayoutsEnabled } from "@/lib/art-runtime-flags";
import { loadArtViewerState } from "@/lib/art-viewer-state.server";
import {
  artEditorialFeatureEnabled,
  fetchEditorialExhibitionBySlug,
  fetchEditorialExhibitions,
  fetchEditorialHomePlacements,
  fetchEditorialPageBySlug,
  fetchEditorialPreview,
  fetchEditorialStories,
  fetchEditorialStoryBySlug,
  fetchEditorialVenueBySlug,
  fetchEditorialVenues,
} from "@/lib/editorial/art-editorial.server";
import {
  loadArtFollowedArtistSlugs,
  loadArtSavedArtworkSlugs,
} from "@/lib/favorites/art-favorites.server";
import { laxAccountPortalHref } from "@/lib/lax-account-url";
import type {
  ArtAccountConfigPort,
  ArtCataloguePort,
  ArtEditorialPort,
  ArtFavoritesReadPort,
  ArtPortalReadPort,
  ArtViewerPort,
} from "@/lib/ports";

export type ArtServices = {
  catalogue: ArtCataloguePort;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
  portal: ArtPortalReadPort;
  account: ArtAccountConfigPort;
  editorial: ArtEditorialPort;
};

/** Composition root: binds page composers to the shop-api and art-identity adapters. */
export const artServices: ArtServices = {
  catalogue: {
    listArtworks: fetchArtChannelArtworks,
    getArtwork: fetchArtChannelArtworkBySlug,
    listArtists: fetchArtChannelArtists,
    getArtist: fetchArtChannelArtistBySlug,
    listCategories: fetchArtChannelCategories,
  },
  viewer: { load: loadArtViewerState },
  favorites: {
    savedArtworkSlugs: loadArtSavedArtworkSlugs,
    followedArtistSlugs: loadArtFollowedArtistSlugs,
    listSavedArtworks: fetchPortalSavedArtworks,
    listFollowedArtists: fetchPortalFollowedArtists,
  },
  portal: {
    listEnquiries: fetchPortalEnquiries,
    listGeneralEnquiries: fetchPortalGeneralEnquiries,
    listCollection: fetchPortalCollection,
    loadPayeeConnect: fetchPortalPayeeConnect,
  },
  account: {
    laxAccountHref: () => laxAccountPortalHref(),
    verifyEmailHref: () => artIdentityUrl("/auth/verify-email"),
    payoutsEnabled: isArtPayoutsEnabled,
  },
  editorial: {
    enabled: artEditorialFeatureEnabled,
    home: fetchEditorialHomePlacements,
    listExhibitions: fetchEditorialExhibitions,
    getExhibition: fetchEditorialExhibitionBySlug,
    listStories: fetchEditorialStories,
    getStory: fetchEditorialStoryBySlug,
    getPage: fetchEditorialPageBySlug,
    listVenues: fetchEditorialVenues,
    getVenue: fetchEditorialVenueBySlug,
    preview: fetchEditorialPreview,
  },
};
