export type ArtNavKey = "home" | "artworks" | "search" | "account";

export type ArtNavItem = {
  key: ArtNavKey;
  href: string;
  label: string;
  active: boolean;
};

const ITEMS: ReadonlyArray<Omit<ArtNavItem, "active">> = [
  { key: "home", href: "/", label: "Home" },
  { key: "artworks", href: "/artworks", label: "Artworks" },
  { key: "search", href: "/search", label: "Search" },
  { key: "account", href: "/account", label: "Account" },
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Artist pages belong to browsing, so they light up Artworks. */
export function resolveArtNavKey(pathname: string): ArtNavKey | null {
  if (pathname === "/") return "home";
  if (matches(pathname, "/artworks") || matches(pathname, "/artists")) return "artworks";
  if (matches(pathname, "/search")) return "search";
  if (
    matches(pathname, "/account") ||
    matches(pathname, "/login") ||
    matches(pathname, "/register")
  ) {
    return "account";
  }
  return null;
}

export function buildArtNavItems(
  pathname: string,
  options: { includeHome: boolean },
): ArtNavItem[] {
  const activeKey = resolveArtNavKey(pathname);
  return ITEMS.filter((item) => options.includeHome || item.key !== "home").map((item) => ({
    ...item,
    active: item.key === activeKey,
  }));
}
