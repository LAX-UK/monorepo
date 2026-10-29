import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { type ClientNavScope, getClientNavItems } from "@/lib/navigation/client-nav-model";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

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

const PERSONAL_SELLER: ClientNavScope = { context: { kind: "personal" }, hasSubmissions: true };
const ORGANISATION_OWNER: ClientNavScope = {
  context: { kind: "organisation", id: "", role: "owner" },
  hasSubmissions: true,
};

/**
 * Every client-area page, so the palette never hides a way in: a personal seller's pages plus an
 * organisation owner's, each once. Organisation pages are left out when organisations are off.
 */
function everyClientPage(orgModuleEnabled: boolean): AppShellNavItem[] {
  const scopes = orgModuleEnabled ? [PERSONAL_SELLER, ORGANISATION_OWNER] : [PERSONAL_SELLER];
  const byId = new Map<string, AppShellNavItem>();
  for (const scope of scopes) {
    for (const item of getClientNavItems(scope)) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

const CLIENT_PALETTE_EXTRAS: PaletteItem[] = [
  { id: "d-sell", href: CLIENT_ROUTES.sellingNew, label: SELL_A_WORK_LABEL },
  { id: "d-gallery", href: "/", label: "Browse gallery", hint: "Marketing site" },
  { id: "d-search", href: "/search", label: "Search lots" },
];

export function buildClientPaletteSections(orgModuleEnabled = true): PaletteSection[] {
  return [
    {
      id: "pages",
      heading: "Pages",
      items: [
        ...appShellNavItemsToPaletteItems(everyClientPage(orgModuleEnabled), "d"),
        ...CLIENT_PALETTE_EXTRAS,
      ],
    },
  ];
}
