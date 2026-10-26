import type { MarketingMegaNavColumn, MarketingMegaNavItem } from "@auction/marketing-ui";

export type ShopMegaMenuItem = MarketingMegaNavItem;

/**
 * A primary nav entry. `items` is the flat list the phone menu shows; on desktop `columns`, when
 * present, replace it, and `linkHref` makes the entry a plain link with no panel.
 */
export type ShopMegaMenuSection = {
  id: string;
  href: string;
  label: string;
  items: readonly ShopMegaMenuItem[];
  columns?: readonly MarketingMegaNavColumn[];
  linkHref?: string;
  viewAllHref: string;
  viewAllLabel: string;
};

export type ShopHeaderNavArtist = { name: string; href: string; imageUrl: string | null };
export type ShopHeaderNavCategory = { label: string; href: string };

/** Catalogue data behind the menus; null when it could not be loaded in time. */
export type ShopHeaderNavData = {
  /** Artists with at least one published edition. */
  artists: readonly ShopHeaderNavArtist[];
  /** Categories that hold a live edition. */
  categories: readonly ShopHeaderNavCategory[];
};

/** A menu panel needs at least this many real destinations; below it the entry is a plain link. */
const MIN_PANEL_LINKS = 3;
export const SHOP_HEADER_NAV_ARTIST_LIMIT = 6;
export const SHOP_HEADER_NAV_CATEGORY_LIMIT = 6;

const EDITION_LINKS: readonly ShopMegaMenuItem[] = [
  { href: "/artworks", label: "All editions" },
  { href: "/artworks?availability=available", label: "Available now" },
  { href: "/categories", label: "All categories" },
];

function editionsSection(data: ShopHeaderNavData | null): ShopMegaMenuSection {
  const categories = (data?.categories ?? []).slice(0, SHOP_HEADER_NAV_CATEGORY_LIMIT);
  const columns: MarketingMegaNavColumn[] = [
    { id: "browse", title: "Browse", items: EDITION_LINKS },
    ...(categories.length > 0
      ? [{ id: "categories", title: "Categories", items: categories }]
      : []),
  ];
  return {
    id: "editions",
    href: "/artworks",
    label: "Editions",
    items: [...EDITION_LINKS, ...categories],
    columns,
    viewAllHref: "/artworks",
    viewAllLabel: "View all editions",
  };
}

function artistsSection(data: ShopHeaderNavData | null): ShopMegaMenuSection {
  const artists = (data?.artists ?? []).slice(0, SHOP_HEADER_NAV_ARTIST_LIMIT);
  const base = {
    id: "artists",
    href: "/artists",
    label: "Artists",
    viewAllHref: "/artists",
    viewAllLabel: "View all artists",
  };
  if (artists.length < MIN_PANEL_LINKS) {
    return { ...base, items: [{ href: "/artists", label: "All artists" }], linkHref: "/artists" };
  }
  return {
    ...base,
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

export const shopMerchandiseNavSection: ShopMegaMenuSection = {
  id: "merchandise",
  href: "/merchandise",
  label: "Merchandise",
  viewAllHref: "/merchandise",
  viewAllLabel: "View all merchandise",
  items: [{ href: "/merchandise", label: "All merchandise" }],
  linkHref: "/merchandise",
};

/**
 * Shop's primary nav: Editions (browse links and the categories that hold editions) and Artists
 * (artists with editions), then Merchandise when it is on. Only real catalogue destinations.
 */
export function buildShopMegaMenuSections(
  merchandiseEnabled: boolean,
  data: ShopHeaderNavData | null = null,
): ShopMegaMenuSection[] {
  const sections = [editionsSection(data), artistsSection(data)];
  return merchandiseEnabled ? [...sections, shopMerchandiseNavSection] : sections;
}
