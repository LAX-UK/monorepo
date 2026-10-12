import {
  type ArtAccountNavHref,
  type ArtAccountNavItem,
  buildArtAccountNavItems,
} from "@/lib/account/account-nav.vm";
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
import type { GeneralEnquiryRow, PortalCollectionItem } from "@auction/shop-contracts";
import type { ShopPortalFetchResult } from "@auction/shop-portal/portal";
import {
  type PayoutAccountViewModel,
  type PortalEnquiryRowViewModel,
  buildPayoutAccountViewModel,
  buildPortalEnquiryListViewModel,
  formatShopDate,
} from "@auction/shop-portal/vm";

type AuthenticatedViewer = Extract<
  Awaited<ReturnType<ArtViewerPort["load"]>>,
  { kind: "authenticated" }
>;

export type ArtAccountPageResult<T> =
  | { kind: "ok"; nav: ArtAccountNavItem[]; vm: T }
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
    nav: buildArtAccountNavItems({ payoutsEnabled: services.account.payoutsEnabled(), activeHref }),
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
};

export function composeArtAccountProfilePage(
  services: AccountServices,
): Promise<ArtAccountPageResult<ArtAccountProfileVm>> {
  return gateAccountPage(services, "/account", async (viewer) => ({
    name: viewer.displayName ?? null,
    email: viewer.email ?? null,
    phone: viewer.verifiedPhone ?? null,
    emailVerified: viewer.emailVerified ?? null,
    laxAccountHref: services.account.laxAccountHref(),
    verifyEmailHref: viewer.emailVerified === false ? services.account.verifyEmailHref() : null,
  }));
}

export type ArtAccountFavoritesVm = {
  artworks: ArtAccountListState<CatalogueArtworkCardVm>;
  artists: ArtAccountListState<CatalogueArtistCardVm>;
  favoriteAuth: ArtFavoriteAuth;
};

export function composeArtAccountFavoritesPage(
  services: AccountServices & { favorites: ArtFavoritesReadPort },
): Promise<ArtAccountPageResult<ArtAccountFavoritesVm>> {
  const path = "/account/favorites";
  return gateAccountPage(services, path, async (viewer) => {
    const [saved, followed] = await Promise.all([
      services.favorites.listSavedArtworks(),
      services.favorites.listFollowedArtists(),
    ]);
    return {
      artworks: toAccountListState(saved, path, buildSavedArtworkCards),
      artists: toAccountListState(followed, path, buildFollowedArtistCards),
      favoriteAuth: buildArtFavoriteAuth(viewer, path),
    };
  });
}

export type ArtGeneralEnquiryRowVm = {
  id: string;
  topicLabel: string;
  messagePreview: string;
  createdAtLabel: string;
  createdAtIso: string;
};

export type ArtAccountInquiriesVm = {
  enquiries: ArtAccountListState<PortalEnquiryRowViewModel>;
  generalEnquiries: ArtAccountListState<ArtGeneralEnquiryRowVm>;
};

function buildGeneralEnquiryRows(items: readonly GeneralEnquiryRow[]): ArtGeneralEnquiryRowVm[] {
  return items.map((row) => ({
    id: row.enquiryId,
    topicLabel: row.topic.replace(/_/g, " "),
    messagePreview: row.message.length > 160 ? `${row.message.slice(0, 157)}…` : row.message,
    createdAtLabel: formatShopDate(row.createdAt),
    createdAtIso: row.createdAt,
  }));
}

export function composeArtAccountInquiriesPage(
  services: AccountServices & { portal: ArtPortalReadPort },
): Promise<ArtAccountPageResult<ArtAccountInquiriesVm>> {
  const path = "/account/inquiries";
  return gateAccountPage(services, path, async () => {
    const [enquiries, generalEnquiries] = await Promise.all([
      services.portal.listEnquiries(),
      services.portal.listGeneralEnquiries(),
    ]);
    return {
      enquiries: toAccountListState(enquiries, path, (items) =>
        buildPortalEnquiryListViewModel(items),
      ),
      generalEnquiries: toAccountListState(generalEnquiries, path, buildGeneralEnquiryRows),
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
  return gateAccountPage(services, path, async () => ({
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
  return gateAccountPage(services, path, async () => {
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
