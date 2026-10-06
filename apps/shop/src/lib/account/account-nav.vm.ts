export type ShopAccountNavItem = {
  href: string;
  label: string;
};

export type BuildShopAccountNavItemsInput = {
  portalOwnershipEnabled: boolean;
  payoutsEnabled: boolean;
  activeHref: string;
};

export function buildShopAccountNavItems({
  portalOwnershipEnabled,
  payoutsEnabled,
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
      { href: "/account/payouts", label: "Payouts" },
      { href: "/account/documents", label: "Documents" },
    );
  }

  return items.map((item) => ({
    ...item,
    active: activeHref === item.href,
  }));
}
