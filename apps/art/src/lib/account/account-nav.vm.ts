export type ArtAccountNavHref =
  | "/account"
  | "/account/enquiries"
  | "/account/collection"
  | "/account/favourites"
  | "/account/favourites/follows"
  | "/account/payouts";

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

/**
 * Figma account tabs (867:16367): Profile | Enquiries. Collection and Payouts are not tabs; they
 * stay reachable from the profile page (see `buildArtAccountSecondaryLinks`).
 */
export function buildArtAccountTabs(activeHref: ArtAccountNavHref): ArtAccountNavItem[] {
  return withActive(
    [
      { id: "profile", href: "/account", label: "Profile" },
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

export type ArtAccountSecondaryLink = { href: ArtAccountNavHref; label: string };

/** Routes Figma omits but the product keeps: reached from the profile page. */
export function buildArtAccountSecondaryLinks(input: {
  payoutsEnabled: boolean;
}): ArtAccountSecondaryLink[] {
  const links: ArtAccountSecondaryLink[] = [
    { href: "/account/collection", label: "Your collection" },
    { href: "/account/favourites", label: "Favourites" },
  ];
  if (input.payoutsEnabled) links.push({ href: "/account/payouts", label: "Payouts" });
  return links;
}
