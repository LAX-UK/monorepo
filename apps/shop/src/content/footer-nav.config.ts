export const shopFooterCopyright = "© 2026  London Art Exchange Ltd";

const shopPolicyRoutes = [
  { label: "Privacy notice", pathname: "/privacy" },
  { label: "Cookie policy", pathname: "/cookies" },
] as const;

export function buildShopPolicyLinks(bidBaseUrl: string) {
  return shopPolicyRoutes.map(({ label, pathname }) => ({
    label,
    href: new URL(pathname, bidBaseUrl).toString(),
  }));
}
