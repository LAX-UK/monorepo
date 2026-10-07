export type ShopAccountNavItem = {
  href: string;
  label: string;
};

export type BuildShopAccountNavItemsInput = {
  portalOwnershipEnabled: boolean;
  payoutsEnabled: boolean;
  artistPortalEnabled?: boolean;
  activeHref: string;
};

export function buildShopAccountNavItems({
  portalOwnershipEnabled,
  payoutsEnabled,
  artistPortalEnabled = false,
  activeHref,
}: BuildShopAccountNavItemsInput): Array<ShopAccountNavItem & { active: boolean }> {
  const items: ShopAccountNavItem[] = [
    { href: "/account", label: "Overview" },
    { href: "/account/orders", label: "Orders" },
  ];
  if (portalOwnershipEnabled) {
    items.push(
      { href: "/account/editions", label: "My editions" },
      { href: "/account/sale-limits", label: "Sale limits" },
    );
  }
  if (payoutsEnabled) {
    items.push(
      { href: "/account/sales", label: "Sales" },
      { href: "/account/payouts", label: "Payouts" },
      { href: "/account/documents", label: "Documents" },
    );
  }
  if (artistPortalEnabled) {
    items.push(
      { href: "/account/artworks", label: "My artworks" },
      { href: "/account/artist-sales", label: "Artist sales" },
    );
  }

  return items.map((item) => ({
    ...item,
    active: activeHref === item.href,
  }));
}
