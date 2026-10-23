import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import {
  type ClientNavScope,
  PERSONAL_NAV_SCOPE,
  getClientNavItems,
} from "@/lib/navigation/client-nav-model";
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

/** The palette lists every page, including organisation ones, so it never hides a way in. */
function paletteScope(orgModuleEnabled: boolean): ClientNavScope {
  return { ...PERSONAL_NAV_SCOPE, orgModuleEnabled, isOrgMember: true };
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
        ...appShellNavItemsToPaletteItems(
          getClientNavItems({ ...paletteScope(orgModuleEnabled), mode: "buying" }),
          "d",
        ),
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
        ...appShellNavItemsToPaletteItems(
          getClientNavItems({ ...paletteScope(orgModuleEnabled), mode: "selling" }),
          "s",
        ),
        ...SELLING_PALETTE_EXTRAS,
      ],
    },
  ];
}
