import {
  fetchArtChannelArtistBySlug,
  fetchArtChannelArtists,
  fetchArtChannelArtworkBySlug,
  fetchArtChannelArtworkObjectTypes,
  fetchArtChannelArtworks,
  fetchArtChannelCategories,
  fetchShopEditionsByArtist,
  fetchShopEditionsOfOriginal,
} from "@/lib/art-catalogue.server";
import { artIdentityUrl } from "@/lib/art-identity.server";
import {
  fetchPortalEnquiries,
  fetchPortalFollowedArtists,
  fetchPortalGeneralEnquiries,
  fetchPortalSavedArtworks,
  fetchPortalSellerAccess,
} from "@/lib/art-portal.server";
import { loadArtViewerState } from "@/lib/art-viewer-state.server";
import { loadArtCrossProductFooterLinks } from "@/lib/ecosystem/product-directory.server";
import {
  searchEditorialExhibitions,
  searchEditorialStories,
} from "@/lib/editorial/art-editorial-search.server";
import {
  artEditorialFeatureEnabled,
  fetchEditorialArtistRelations,
  fetchEditorialExhibitionBySlug,
  fetchEditorialExhibitions,
  fetchEditorialHomePlacements,
  fetchEditorialPageBySlug,
  fetchEditorialPages,
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
import {
  fetchHelpArticleBySlug,
  fetchHelpArticles,
  fetchHelpCategories,
} from "@/lib/help/art-help.server";
import { laxAccountUrl } from "@/lib/lax-account-url";
import type {
  ArtAccountConfigPort,
  ArtCataloguePort,
  ArtEcosystemPort,
  ArtEditorialPort,
  ArtEditorialSearchPort,
  ArtFavoritesReadPort,
  ArtHelpPort,
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
  editorialSearch: ArtEditorialSearchPort;
  help: ArtHelpPort;
  ecosystem: ArtEcosystemPort;
};

/** Composition root: binds page composers to the shop-api and art-identity adapters. */
export const artServices: ArtServices = {
  catalogue: {
    listArtworks: fetchArtChannelArtworks,
    getArtwork: fetchArtChannelArtworkBySlug,
    listArtists: fetchArtChannelArtists,
    getArtist: fetchArtChannelArtistBySlug,
    listCategories: fetchArtChannelCategories,
    listArtworkObjectTypes: fetchArtChannelArtworkObjectTypes,
    listShopEditionsOfOriginal: fetchShopEditionsOfOriginal,
    listShopEditionsByArtist: fetchShopEditionsByArtist,
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
    loadSellerAccess: fetchPortalSellerAccess,
  },
  account: {
    laxAccountUrl,
    verifyEmailHref: () => artIdentityUrl("/auth/verify-email"),
  },
  editorial: {
    enabled: artEditorialFeatureEnabled,
    home: fetchEditorialHomePlacements,
    listExhibitions: fetchEditorialExhibitions,
    getExhibition: fetchEditorialExhibitionBySlug,
    listStories: fetchEditorialStories,
    getStory: fetchEditorialStoryBySlug,
    getArtistRelations: fetchEditorialArtistRelations,
    listPages: fetchEditorialPages,
    getPage: fetchEditorialPageBySlug,
    listVenues: fetchEditorialVenues,
    getVenue: fetchEditorialVenueBySlug,
    preview: fetchEditorialPreview,
  },
  editorialSearch: {
    searchExhibitions: searchEditorialExhibitions,
    searchStories: searchEditorialStories,
  },
  help: {
    listCategories: fetchHelpCategories,
    listArticles: fetchHelpArticles,
    getArticle: fetchHelpArticleBySlug,
  },
  ecosystem: { crossProductLinks: loadArtCrossProductFooterLinks },
};
