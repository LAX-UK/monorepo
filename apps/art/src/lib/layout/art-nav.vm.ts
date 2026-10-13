export type ArtNavKey = "artists" | "artworks" | "exhibitions" | "artHub" | "collectorHub";

export type ArtNavItem = {
  key: ArtNavKey;
  href: string;
  label: string;
  active: boolean;
};

const ITEMS: ReadonlyArray<Omit<ArtNavItem, "active">> = [
  { key: "artists", href: "/artists", label: "Artists" },
  { key: "artworks", href: "/artworks", label: "Artworks" },
  { key: "exhibitions", href: "/exhibitions", label: "Exhibitions" },
  { key: "artHub", href: "/art-hub", label: "Art Hub" },
  { key: "collectorHub", href: "/collector-hub", label: "Collector Hub" },
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveArtNavKey(pathname: string): ArtNavKey | null {
  if (matches(pathname, "/artists")) return "artists";
  if (matches(pathname, "/artworks")) return "artworks";
  if (matches(pathname, "/exhibitions")) return "exhibitions";
  if (matches(pathname, "/art-hub")) return "artHub";
  if (matches(pathname, "/collector-hub")) return "collectorHub";
  return null;
}

export function buildArtNavItems(pathname: string): ArtNavItem[] {
  const activeKey = resolveArtNavKey(pathname);
  return ITEMS.map((item) => ({
    ...item,
    active: item.key === activeKey,
  }));
}

/** Mobile bottom bar — catalogue shortcuts separate from editorial primary nav. */
export type ArtMobileNavKey = "home" | "discover" | "favorites" | "account";

export type ArtMobileNavItem = {
  key: ArtMobileNavKey;
  href: string;
  label: string;
  active: boolean;
};

const MOBILE_ITEMS: ReadonlyArray<Omit<ArtMobileNavItem, "active">> = [
  { key: "home", href: "/", label: "Home" },
  { key: "discover", href: "/artworks", label: "Discover" },
  { key: "favorites", href: "/account/favorites", label: "Favorites" },
  { key: "account", href: "/account", label: "Account" },
];

const ACCOUNT_TAB_PREFIXES = [
  "/account",
  "/login",
  "/register",
  "/signed-out",
  "/session-expired",
] as const;

export function resolveArtMobileNavKey(pathname: string): ArtMobileNavKey | null {
  if (pathname === "/") return "home";
  if (matches(pathname, "/account/favorites")) return "favorites";
  if (
    matches(pathname, "/artworks") ||
    matches(pathname, "/artists") ||
    matches(pathname, "/search")
  ) {
    return "discover";
  }
  if (ACCOUNT_TAB_PREFIXES.some((prefix) => matches(pathname, prefix))) return "account";
  return null;
}

export function buildArtMobileNavItems(pathname: string): ArtMobileNavItem[] {
  const activeKey = resolveArtMobileNavKey(pathname);
  return MOBILE_ITEMS.map((item) => ({
    ...item,
    active: item.key === activeKey,
  }));
}
