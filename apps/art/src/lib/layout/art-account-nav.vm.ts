export type ArtAccountLink = { href: string; label: string };

/** Signed-in destinations shared by the desktop account menu and the mobile drawer. */
export const ART_ACCOUNT_LINKS: readonly ArtAccountLink[] = [
  { href: "/account/favorites", label: "Favorites" },
  { href: "/account/inquiries", label: "Inquiries" },
  { href: "/account/collection", label: "Collection" },
];

export type ArtMobileAccountLink = ArtAccountLink & { current: boolean };

/** Drawer account list: the overview first, then the account sections, with the current page marked. */
export function buildArtMobileAccountLinks(
  accountHref: string,
  pathname: string,
): ArtMobileAccountLink[] {
  const overview = { href: accountHref, label: "My account" };
  return [overview, ...ART_ACCOUNT_LINKS].map((link) => ({
    ...link,
    current: pathname === link.href || (link !== overview && pathname.startsWith(`${link.href}/`)),
  }));
}

export function artAccountDisplayName(displayName: string): string {
  return displayName.trim() || "Signed in";
}

export function artAccountInitials(displayName: string, email: string): string {
  const source = displayName.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
