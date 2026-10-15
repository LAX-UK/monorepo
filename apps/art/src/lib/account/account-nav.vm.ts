export type ArtAccountNavHref =
  | "/account"
  | "/account/enquiries"
  | "/account/collection"
  | "/account/favourites"
  | "/account/payouts";

export type ArtAccountNavItem = {
  href: ArtAccountNavHref;
  label: string;
  active: boolean;
};

export function buildArtAccountNavItems(input: {
  payoutsEnabled: boolean;
  activeHref: ArtAccountNavHref;
}): ArtAccountNavItem[] {
  const items: Array<Omit<ArtAccountNavItem, "active">> = [
    { href: "/account", label: "Profile" },
    { href: "/account/enquiries", label: "Enquiries" },
    { href: "/account/collection", label: "Collection" },
    { href: "/account/favourites", label: "Favourites" },
  ];
  if (input.payoutsEnabled) items.push({ href: "/account/payouts", label: "Payouts" });
  return items.map((item) => ({ ...item, active: item.href === input.activeHref }));
}
