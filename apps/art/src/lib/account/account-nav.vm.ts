import {
  type ArtAccountCapabilities,
  type ArtAccountCapability,
  holdsCapability,
} from "@/lib/account/art-account-capabilities";
import type { LaxAccountDestination } from "@auction/lax-ecosystem/lax-account-origin";

export type ArtAccountNavHref =
  | "/account"
  | "/account/enquiries"
  | "/account/favourites"
  | "/account/favourites/follows";

/** A route tab; `active` marks the current route so the shell never compares paths itself. */
export type ArtAccountNavItem = {
  id: string;
  href: ArtAccountNavHref;
  label: string;
  active: boolean;
};

function withActive(
  items: ReadonlyArray<Omit<ArtAccountNavItem, "active">>,
  activeHref: ArtAccountNavHref,
): ArtAccountNavItem[] {
  return items.map((item) => ({ ...item, active: item.href === activeHref }));
}

/** Figma account tabs (867:16367), with the first named for what it is: an overview. */
export function buildArtAccountTabs(activeHref: ArtAccountNavHref): ArtAccountNavItem[] {
  return withActive(
    [
      { id: "overview", href: "/account", label: "Overview" },
      { id: "enquiries", href: "/account/enquiries", label: "Enquiries" },
    ],
    activeHref,
  );
}

/** Figma favourites tabs (867:15986). Two routes rather than a query string; see DESIGN_SYSTEM.md. */
export function buildArtFavouritesTabs(activeHref: ArtAccountNavHref): ArtAccountNavItem[] {
  return withActive(
    [
      { id: "saves", href: "/account/favourites", label: "Saves" },
      { id: "follows", href: "/account/favourites/follows", label: "Follows" },
    ],
    activeHref,
  );
}

export type ArtAccountDestinationId = "favourites" | "following" | "payouts" | "lax-account";

type ArtAccountDestinationDefinition = {
  id: ArtAccountDestinationId;
  title: string;
  subtitle: string;
  /** A lax.art page, or a LAX Account page for what lax.art does not keep. */
  to:
    | { kind: "art"; href: ArtAccountNavHref }
    | { kind: "lax-account"; page: LaxAccountDestination };
  /** Shown only to people who hold it; absent means every collector. */
  requires?: ArtAccountCapability;
};

/**
 * The account overview's rows, in order. lax.art keeps favourites, follows and enquiries (the
 * enquiries lead the page above these rows). Payouts are a seller tool in LAX Account, offered
 * only to payees; everything else about the person lives in LAX Account. A new row is a new
 * entry here, never a condition in a page.
 */
const ART_ACCOUNT_DESTINATIONS: readonly ArtAccountDestinationDefinition[] = [
  {
    id: "favourites",
    title: "Favourites",
    subtitle: "Works you have saved",
    to: { kind: "art", href: "/account/favourites" },
  },
  {
    id: "following",
    title: "Following",
    subtitle: "Artists you follow",
    to: { kind: "art", href: "/account/favourites/follows" },
  },
  {
    id: "payouts",
    title: "Payouts",
    subtitle: "Sales and payouts, in LAX Account",
    to: { kind: "lax-account", page: "sellingPayouts" },
    requires: "receivesPayouts",
  },
  {
    id: "lax-account",
    title: "Manage your details in LAX Account",
    subtitle: "Name, email, phone, addresses, security and your collection",
    to: { kind: "lax-account", page: "home" },
  },
];

export type ArtAccountDestinationVm = {
  id: ArtAccountDestinationId;
  title: string;
  subtitle: string;
  href: string;
  /** Opens another LAX product, so the row shows an outward arrow. */
  external: boolean;
  /** How many items the row holds ("3"); null when unknown or not a list. */
  countLabel: string | null;
};

export function buildArtAccountDestinations(input: {
  capabilities: ArtAccountCapabilities;
  laxAccountUrl: (page: LaxAccountDestination) => string;
  /** Item counts by row, when they were read; a missing count shows nothing. */
  counts?: Partial<Record<ArtAccountDestinationId, number | undefined>>;
}): ArtAccountDestinationVm[] {
  return ART_ACCOUNT_DESTINATIONS.filter(
    (row) => row.requires === undefined || holdsCapability(input.capabilities, row.requires),
  ).map((row) => {
    const count = input.counts?.[row.id];
    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      href: row.to.kind === "art" ? row.to.href : input.laxAccountUrl(row.to.page),
      external: row.to.kind === "lax-account",
      countLabel: count === undefined ? null : String(count),
    };
  });
}
