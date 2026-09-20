export type ShopMegaMenuItem = {
  href: string;
  label: string;
};

export type ShopMegaMenuSection = {
  id: string;
  href: string;
  label: string;
  items: readonly ShopMegaMenuItem[];
  viewAllHref: string;
  viewAllLabel: string;
};

/** Shop-owned IA — real catalogue destinations only, never Bid auction/sell routes. */
export const shopMegaMenuSections = [
  {
    id: "collect",
    href: "/artworks",
    label: "Collect",
    viewAllHref: "/artworks",
    viewAllLabel: "View all artworks",
    items: [
      { href: "/artworks", label: "All artworks" },
      { href: "/categories", label: "Shop by category" },
    ],
  },
  {
    id: "artists",
    href: "/artists",
    label: "Artists",
    viewAllHref: "/artists",
    viewAllLabel: "View all artists",
    items: [{ href: "/artists", label: "Browse all artists" }],
  },
] as const satisfies readonly ShopMegaMenuSection[];

export const shopPrimaryLinks = shopMegaMenuSections.map((section) => ({
  href: section.href,
  label: section.label,
}));
