import {
  getClientBuyingNavItems,
  getClientSellingNavItems,
} from "@/components/layout/app-shell-nav";
import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
export function appShellNavItemsToPaletteItems(
  items: readonly AppShellNavItem[],
  idPrefix: string,
): PaletteItem[] {
  return items.map((item) => ({
    id: `${idPrefix}-${item.id}`,
    href: item.href,
    label: item.label,
  }));
}

const BUYING_PALETTE_EXTRAS: PaletteItem[] = [
  { id: "d-gallery", href: "/", label: "Browse gallery", hint: "Marketing site" },
  { id: "d-search", href: "/search", label: "Search lots" },
];

const SELLING_PALETTE_EXTRAS: PaletteItem[] = [
  { id: "s-search", href: "/search", label: "Search lots" },
];

export function buildClientBuyingPaletteSections(orgModuleEnabled = true): PaletteSection[] {
  return [
    {
      id: "pages",
      heading: "Pages",
      items: [
        ...appShellNavItemsToPaletteItems(getClientBuyingNavItems(orgModuleEnabled), "d"),
        ...BUYING_PALETTE_EXTRAS,
      ],
    },
  ];
}

export function buildClientSellingPaletteSections(orgModuleEnabled = true): PaletteSection[] {
  return [
    {
      id: "seller",
      heading: "Selling workspace",
      items: [
        ...appShellNavItemsToPaletteItems(getClientSellingNavItems(orgModuleEnabled), "s"),
        ...SELLING_PALETTE_EXTRAS,
      ],
    },
  ];
}
