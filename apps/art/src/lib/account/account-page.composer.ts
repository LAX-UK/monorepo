import {
  type ArtEnquiryItemVm,
  buildArtworkEnquiryItem,
  buildGeneralEnquiryItem,
  mergeEnquiryItems,
} from "@/lib/account/account-enquiries.vm";
import {
  type ArtAccountDestinationVm,
  type ArtAccountNavHref,
  type ArtAccountNavItem,
  buildArtAccountDestinations,
  buildArtAccountTabs,
  buildArtFavouritesTabs,
} from "@/lib/account/account-nav.vm";
import {
  ART_ACCOUNT_PROMOS,
  type ArtAccountPromoVm,
  type ArtProfileBannerVm,
  accountInitials,
  buildProfileIncompleteBanner,
} from "@/lib/account/account-profile.vm";
import { artAccountCapabilitiesFrom } from "@/lib/account/art-account-capabilities";
import { artStorefrontLoginHref, gateArtAuthenticatedRoute } from "@/lib/art-viewer-state";
import {
  type CatalogueArtistCardVm,
  buildFollowedArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  buildSavedArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import { type ArtFavoriteAuth, buildArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import type {
  ArtAccountConfigPort,
  ArtFavoritesReadPort,
  ArtPortalReadPort,
  ArtViewerPort,
} from "@/lib/ports";
import type { ShopPortalFetchResult } from "@auction/shop-portal/portal";

type AuthenticatedViewer = Extract<
  Awaited<ReturnType<ArtViewerPort["load"]>>,
  { kind: "authenticated" }
>;

/** Who the monogram band shows; the same on every account route. */
export type ArtAccountIdentityVm = {
  name: string | null;
  email: string | null;
  initials: string | null;
};

export type ArtAccountPageResult<T> =
  | { kind: "ok"; nav: ArtAccountNavItem[]; identity: ArtAccountIdentityVm; vm: T }
  | { kind: "redirect"; to: string }
  | { kind: "unavailable"; message: string };

/** Per-section list state; `sign_in` covers a session that lapsed between gate and read. */
export type ArtAccountListState<T> =
  | { kind: "ok"; items: T[] }
  | { kind: "empty" }
  | { kind: "sign_in"; loginHref: string }
  | { kind: "failed" };

type AccountServices = { viewer: ArtViewerPort; account: ArtAccountConfigPort };

async function gateAccountPage<T>(
  services: AccountServices,
  activeHref: ArtAccountNavHref,
  nav: ArtAccountNavItem[],
  build: (viewer: AuthenticatedViewer) => Promise<T>,
): Promise<ArtAccountPageResult<T>> {
  const viewer = await services.viewer.load();
  const gate = gateArtAuthenticatedRoute(viewer, activeHref);
  if (!gate.allowed) {
    if (gate.redirectTo) return { kind: "redirect", to: gate.redirectTo };
    return {
      kind: "unavailable",
      message: viewer.kind === "unavailable" ? viewer.message : "Your account is unavailable.",
    };
  }
  if (viewer.kind !== "authenticated")
    return { kind: "redirect", to: artStorefrontLoginHref(activeHref) };
  return {
    kind: "ok",
    nav,
    identity: {
      name: viewer.displayName ?? null,
      email: viewer.email ?? null,
      initials: accountInitials(viewer.displayName ?? null, viewer.email ?? null),
    },
    vm: await build(viewer),
  };
}

export function toAccountListState<T, R>(
  result: ShopPortalFetchResult<T[]>,
  returnTo: string,
  map: (items: T[]) => R[],
): ArtAccountListState<R> {
  switch (result.status) {
    case "ok": {
      const items = map(result.data);
      return items.length > 0 ? { kind: "ok", items } : { kind: "empty" };
    }
    case "empty":
      return { kind: "empty" };
    case "unauthorized":
      return { kind: "sign_in", loginHref: artStorefrontLoginHref(returnTo) };
    case "commerce_unavailable":
    case "failed":
      return { kind: "failed" };
  }
}

/**
 * Both reads feed one list. A failure on one side only matters when nothing else can be shown;
 * a lapsed session on either side asks for sign-in because the other read shares the session.
 */
export function mergeEnquiryStates(
  artwork: ArtAccountListState<ArtEnquiryItemVm>,
  general: ArtAccountListState<ArtEnquiryItemVm>,
): ArtAccountListState<ArtEnquiryItemVm> {
  const signIn = [artwork, general].find((state) => state.kind === "sign_in");
  if (signIn) return signIn;
  const items = mergeEnquiryItems(
    artwork.kind === "ok" ? artwork.items : [],
    general.kind === "ok" ? general.items : [],
  );
  if (items.length > 0) return { kind: "ok", items };
  return artwork.kind === "failed" || general.kind === "failed"
    ? { kind: "failed" }
    : { kind: "empty" };
}

/** Artwork and general enquiries as one list, newest first. */
async function loadEnquiries(
  portal: Pick<ArtPortalReadPort, "listEnquiries" | "listGeneralEnquiries">,
  returnTo: string,
): Promise<ArtAccountListState<ArtEnquiryItemVm>> {
  const [artwork, general] = await Promise.all([
    portal.listEnquiries(),
    portal.listGeneralEnquiries(),
  ]);
  return mergeEnquiryStates(
    toAccountListState(artwork, returnTo, (rows) => rows.map(buildArtworkEnquiryItem)),
    toAccountListState(general, returnTo, (rows) => rows.map(buildGeneralEnquiryItem)),
  );
}

/** How many enquiries the overview shows before "View all". */
export const OVERVIEW_ENQUIRY_LIMIT = 3;

export type ArtAccountOverviewVm = {
  banner: ArtProfileBannerVm | null;
  /** The latest enquiries; the full list is the Enquiries tab. */
  enquiries: ArtAccountListState<ArtEnquiryItemVm>;
  /** True when the overview shows only some of the enquiries. */
  moreEnquiries: boolean;
  /** Favourites, Following, Payouts for payees, and LAX Account, as rows. */
  destinations: ArtAccountDestinationVm[];
  promos: readonly ArtAccountPromoVm[];
};

function countOf<T>(result: ShopPortalFetchResult<T[]>): number | undefined {
  if (result.status === "ok") return result.data.length;
  return result.status === "empty" ? 0 : undefined;
}

/**
 * The collector's desk: what needs a reply first (enquiries), then saved works and followed
 * artists. Profile, addresses, security, the collection and money are LAX Account pages, so the
 * overview links there instead of repeating them; Payouts appear only for payees.
 */
export function composeArtAccountOverviewPage(
  services: AccountServices & {
    portal: ArtPortalReadPort;
    favorites: Pick<ArtFavoritesReadPort, "listSavedArtworks" | "listFollowedArtists">;
  },
): Promise<ArtAccountPageResult<ArtAccountOverviewVm>> {
  const path = "/account";
  return gateAccountPage(services, path, buildArtAccountTabs(path), async (viewer) => {
    const [enquiries, sellerAccess, saved, followed] = await Promise.all([
      loadEnquiries(services.portal, path),
      services.portal.loadSellerAccess(),
      services.favorites.listSavedArtworks(),
      services.favorites.listFollowedArtists(),
    ]);
    const verifyEmailHref =
      viewer.emailVerified === false ? services.account.verifyEmailHref() : null;
    const latest =
      enquiries.kind === "ok"
        ? { kind: "ok" as const, items: enquiries.items.slice(0, OVERVIEW_ENQUIRY_LIMIT) }
        : enquiries;
    return {
      banner: buildProfileIncompleteBanner({
        name: viewer.displayName ?? null,
        emailVerified: viewer.emailVerified ?? null,
        phone: viewer.verifiedPhone ?? null,
        verifyEmailHref,
        laxAccountHref: services.account.laxAccountUrl("profile"),
      }),
      enquiries: latest,
      moreEnquiries: enquiries.kind === "ok" && enquiries.items.length > OVERVIEW_ENQUIRY_LIMIT,
      destinations: buildArtAccountDestinations({
        capabilities: artAccountCapabilitiesFrom(sellerAccess),
        laxAccountUrl: services.account.laxAccountUrl,
        counts: { favourites: countOf(saved), following: countOf(followed) },
      }),
      promos: ART_ACCOUNT_PROMOS,
    };
  });
}

export type ArtAccountSavesVm = {
  artworks: ArtAccountListState<CatalogueArtworkCardVm>;
  favoriteAuth: ArtFavoriteAuth;
};

export function composeArtAccountSavesPage(
  services: AccountServices & { favorites: ArtFavoritesReadPort },
): Promise<ArtAccountPageResult<ArtAccountSavesVm>> {
  const path = "/account/favourites";
  return gateAccountPage(services, path, buildArtFavouritesTabs(path), async (viewer) => ({
    artworks: toAccountListState(
      await services.favorites.listSavedArtworks(),
      path,
      buildSavedArtworkCards,
    ),
    favoriteAuth: buildArtFavoriteAuth(viewer, path),
  }));
}

export type ArtAccountFollowsVm = {
  artists: ArtAccountListState<CatalogueArtistCardVm>;
  favoriteAuth: ArtFavoriteAuth;
};

export function composeArtAccountFollowsPage(
  services: AccountServices & { favorites: ArtFavoritesReadPort },
): Promise<ArtAccountPageResult<ArtAccountFollowsVm>> {
  const path = "/account/favourites/follows";
  return gateAccountPage(services, path, buildArtFavouritesTabs(path), async (viewer) => ({
    artists: toAccountListState(
      await services.favorites.listFollowedArtists(),
      path,
      buildFollowedArtistCards,
    ),
    favoriteAuth: buildArtFavoriteAuth(viewer, path),
  }));
}

export type ArtAccountEnquiriesVm = {
  enquiries: ArtAccountListState<ArtEnquiryItemVm>;
};

export function composeArtAccountEnquiriesPage(
  services: AccountServices & { portal: ArtPortalReadPort },
): Promise<ArtAccountPageResult<ArtAccountEnquiriesVm>> {
  const path = "/account/enquiries";
  return gateAccountPage(services, path, buildArtAccountTabs(path), async () => ({
    enquiries: await loadEnquiries(services.portal, path),
  }));
}
