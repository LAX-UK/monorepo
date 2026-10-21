import {
  ARTWORK_OBJECT_TYPE_LABELS,
  type ArtworkCatalogueUrlState,
  type ArtworkObjectType,
  artworkCatalogueHref,
} from "@/lib/catalogue/artwork-catalogue-params";
import type {
  MarketingHeaderSearchSuggestion,
  MarketingMegaNavColumn,
  MarketingMegaNavSection,
} from "@auction/marketing-ui";

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

export type ArtHeaderNavArtist = { name: string; href: string; imageUrl: string | null };

/** Catalogue data behind the desktop mega menus; null when it could not be loaded in time. */
export type ArtHeaderNavData = {
  artists: readonly ArtHeaderNavArtist[];
  /** Object types that currently have works on lax.art. */
  objectTypes: readonly ArtworkObjectType[];
};

export type ArtMegaNavSection = MarketingMegaNavSection & { key: ArtNavKey };

const EXHIBITION_LINKS = [
  { href: "/exhibitions", label: "Current" },
  { href: "/exhibitions?status=upcoming", label: "Upcoming" },
  { href: "/exhibitions?status=past", label: "Past" },
] as const;

function catalogueHref(patch: Partial<ArtworkCatalogueUrlState>): string {
  return artworkCatalogueHref({ type: "all", sort: "newest", ...patch });
}

function plainSection(item: Omit<ArtNavItem, "active">): ArtMegaNavSection {
  return { key: item.key, id: item.key, label: item.label, items: [], linkHref: item.href };
}

function artistsSection(
  base: Omit<ArtNavItem, "active">,
  artists: readonly ArtHeaderNavArtist[],
): ArtMegaNavSection {
  if (artists.length === 0) return plainSection(base);
  return {
    key: base.key,
    id: base.key,
    label: base.label,
    viewAllHref: base.href,
    viewAllLabel: "View all artists",
    items: artists.map((artist) => ({
      href: artist.href,
      label: artist.name,
      ...(artist.imageUrl
        ? {
            media: {
              src: artist.imageUrl,
              alt: `Portrait of ${artist.name}`,
              caption: artist.name,
            },
          }
        : {}),
    })),
  };
}

function artworksSection(
  base: Omit<ArtNavItem, "active">,
  objectTypes: readonly ArtworkObjectType[],
): ArtMegaNavSection {
  const columns: MarketingMegaNavColumn[] = [
    {
      id: "type",
      title: "By type",
      items: [
        { href: catalogueHref({ type: "original" }), label: "Originals" },
        { href: catalogueHref({ type: "edition" }), label: "Prints & editions" },
      ],
    },
  ];
  if (objectTypes.length > 0) {
    columns.push({
      id: "medium",
      title: "By medium",
      items: objectTypes.map((objectType) => ({
        href: catalogueHref({ objectType }),
        label: ARTWORK_OBJECT_TYPE_LABELS[objectType],
      })),
    });
  }
  return {
    key: base.key,
    id: base.key,
    label: base.label,
    items: [],
    columns,
    viewAllHref: base.href,
    viewAllLabel: "View all artworks",
  };
}

/**
 * Desktop primary nav (Figma `521:7889`): Artists, Artworks and Exhibitions open mega menus,
 * the hubs are plain links. Without catalogue data every item is a plain link.
 */
export function buildArtMegaNavSections(data: ArtHeaderNavData | null): ArtMegaNavSection[] {
  return ITEMS.map((item) => {
    if (!data) return plainSection(item);
    switch (item.key) {
      case "artists":
        return artistsSection(item, data.artists);
      case "artworks":
        return artworksSection(item, data.objectTypes);
      case "exhibitions":
        return { key: item.key, id: item.key, label: item.label, items: [...EXHIBITION_LINKS] };
      default:
        return plainSection(item);
    }
  });
}

/** Header search "Suggested" list: the featured artists already loaded for the mega menu. */
export function buildArtSearchSuggestions(
  data: ArtHeaderNavData | null,
): MarketingHeaderSearchSuggestion[] {
  return (data?.artists ?? []).map((artist) => ({ label: artist.name, href: artist.href }));
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
  { key: "favorites", href: "/account/favourites", label: "Favourites" },
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
  if (matches(pathname, "/account/favourites")) return "favorites";
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
