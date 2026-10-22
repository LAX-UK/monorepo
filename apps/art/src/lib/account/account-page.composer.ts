import {
  type ArtEnquiryItemVm,
  buildArtworkEnquiryItem,
  buildGeneralEnquiryItem,
  mergeEnquiryItems,
} from "@/lib/account/account-enquiries.vm";
import {
  type ArtAccountNavHref,
  type ArtAccountNavItem,
  type ArtAccountSecondaryLink,
  buildArtAccountSecondaryLinks,
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
import { artStorefrontLoginHref, gateArtAuthenticatedRoute } from "@/lib/art-viewer-state";
import {
  type CatalogueArtistCardVm,
  buildFollowedArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  artworkHref,
  buildSavedArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import { type ArtFavoriteAuth, buildArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import type {
  ArtAccountConfigPort,
  ArtFavoritesReadPort,
  ArtPortalReadPort,
  ArtViewerPort,
} from "@/lib/ports";
import type { PortalCollectionItem } from "@auction/shop-contracts";
import type { ShopPortalFetchResult } from "@auction/shop-portal/portal";
import {
  type PayoutAccountViewModel,
  buildPayoutAccountViewModel,
  formatShopDate,
} from "@auction/shop-portal/vm";

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
  | { kind: "unavailable"; message: string }
  | { kind: "not_found" };

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

export type ArtAccountProfileVm = {
  name: string | null;
  email: string | null;
  phone: string | null;
  emailVerified: boolean | null;
  /** Hidden when NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN is not configured. */
  laxAccountHref: string | null;
  verifyEmailHref: string | null;
  banner: ArtProfileBannerVm | null;
  secondaryLinks: ArtAccountSecondaryLink[];
  promos: readonly ArtAccountPromoVm[];
};

export function composeArtAccountProfilePage(
  services: AccountServices,
): Promise<ArtAccountPageResult<ArtAccountProfileVm>> {
  return gateAccountPage(services, "/account", buildArtAccountTabs("/account"), async (viewer) => {
    const laxAccountHref = services.account.laxAccountHref();
    const verifyEmailHref =
      viewer.emailVerified === false ? services.account.verifyEmailHref() : null;
    return {
      name: viewer.displayName ?? null,
      email: viewer.email ?? null,
      phone: viewer.verifiedPhone ?? null,
      emailVerified: viewer.emailVerified ?? null,
      laxAccountHref,
      verifyEmailHref,
      banner: buildProfileIncompleteBanner({
        name: viewer.displayName ?? null,
        emailVerified: viewer.emailVerified ?? null,
        phone: viewer.verifiedPhone ?? null,
        verifyEmailHref,
        laxAccountHref,
      }),
      secondaryLinks: buildArtAccountSecondaryLinks({
        payoutsEnabled: services.account.payoutsEnabled(),
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

export function composeArtAccountEnquiriesPage(
  services: AccountServices & { portal: ArtPortalReadPort },
): Promise<ArtAccountPageResult<ArtAccountEnquiriesVm>> {
  const path = "/account/enquiries";
  return gateAccountPage(services, path, buildArtAccountTabs(path), async () => {
    const [artwork, general] = await Promise.all([
      services.portal.listEnquiries(),
      services.portal.listGeneralEnquiries(),
    ]);
    return {
      enquiries: mergeEnquiryStates(
        toAccountListState(artwork, path, (rows) => rows.map(buildArtworkEnquiryItem)),
        toAccountListState(general, path, (rows) => rows.map(buildGeneralEnquiryItem)),
      ),
    };
  });
}

export type ArtCollectionRowVm = {
  key: string;
  title: string;
  /** Only lax.art works link back into this storefront. */
  href: string | null;
  kindLabel: string;
  sourceLabel: string;
  detail: string | null;
};

export function buildArtCollectionRows(
  items: readonly PortalCollectionItem[],
): ArtCollectionRowVm[] {
  return items.map((item) => {
    const base = {
      title: item.artworkTitle,
      href: item.salesChannel === "art" ? artworkHref(item.artworkSlug) : null,
      sourceLabel: item.salesChannel === "art" ? "lax.art" : "LAX Shop",
    };
    if (item.kind === "edition") {
      return {
        ...base,
        key: `edition-${item.editionId}`,
        kindLabel: `Edition #${item.editionNumber}`,
        detail: null,
      };
    }
    const acquired = Date.parse(item.acquiredAt);
    return {
      ...base,
      key: `original-${item.originalSaleId}`,
      kindLabel: "Original",
      detail: Number.isNaN(acquired) ? null : `Acquired ${formatShopDate(item.acquiredAt)}`,
    };
  });
}

export type ArtAccountCollectionVm = {
  collection: ArtAccountListState<ArtCollectionRowVm>;
};

export function composeArtAccountCollectionPage(
  services: AccountServices & { portal: ArtPortalReadPort },
): Promise<ArtAccountPageResult<ArtAccountCollectionVm>> {
  const path = "/account/collection";
  return gateAccountPage(services, path, [], async () => ({
    collection: toAccountListState(
      await services.portal.listCollection(),
      path,
      buildArtCollectionRows,
    ),
  }));
}

export type ArtAccountPayoutsVm = {
  payouts:
    | { kind: "ok"; viewModel: PayoutAccountViewModel; publishableKey: string | null }
    | { kind: "sign_in"; loginHref: string }
    | { kind: "failed" };
};

export async function composeArtAccountPayoutsPage(
  services: AccountServices & { portal: ArtPortalReadPort },
): Promise<ArtAccountPageResult<ArtAccountPayoutsVm>> {
  if (!services.account.payoutsEnabled()) return { kind: "not_found" };
  const path = "/account/payouts";
  return gateAccountPage(services, path, [], async () => {
    const connect = await services.portal.loadPayeeConnect();
    if (connect.status === "ok") {
      return {
        payouts: {
          kind: "ok",
          viewModel: buildPayoutAccountViewModel(connect.data.status),
          publishableKey: connect.data.config.publishableKey,
        },
      };
    }
    if (connect.status === "unauthorized") {
      return { payouts: { kind: "sign_in", loginHref: artStorefrontLoginHref(path) } };
    }
    return { payouts: { kind: "failed" } };
  });
}
