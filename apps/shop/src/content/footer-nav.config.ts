/** Shop has no policy pages of its own; these are the LAX Bid documents that govern Shop orders. */
const shopPolicyRoutes = [
  { label: "Conditions of business", pathname: "/terms" },
  { label: "Privacy notice", pathname: "/privacy" },
  { label: "Cookie policy", pathname: "/cookies" },
  { label: "Shipping & logistics", pathname: "/shipping" },
] as const;

export function buildShopPolicyLinks(bidBaseUrl: string) {
  return shopPolicyRoutes.map(({ label, pathname }) => ({
    label,
    href: new URL(pathname, bidBaseUrl).toString(),
  }));
}
