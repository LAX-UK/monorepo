export type PolicyRoute = {
  href: string;
  /** Tab label in the policy hub top nav. */
  label: string;
  /** Verbose label in the policy hub sidebar. */
  sidebarLabel: string;
  /** Verbose label used in the footer + /legal index (defaults to `label`). */
  footerLabel?: string;
  /** Part of the legal policy cluster (/legal index). */
  legal?: boolean;
};

/** Canonical manifest for every policy-hub surface. The hub nav and the /legal
 * index are derived from this list so the order and labels stay in lock-step. */
export const policyRoutes: readonly PolicyRoute[] = [
  { href: "/about", label: "About", sidebarLabel: "About" },
  { href: "/legal", label: "Legal", sidebarLabel: "Legal hub", footerLabel: "Legal" },
  { href: "/buy", label: "Buy", sidebarLabel: "Buying at LAX.BID" },
  { href: "/sell", label: "Sell", sidebarLabel: "Selling with LAX.BID" },
  { href: "/contact", label: "Contact", sidebarLabel: "Contact" },
  { href: "/press", label: "Press", sidebarLabel: "Press & media" },
  { href: "/faq", label: "FAQ", sidebarLabel: "FAQ" },
  {
    href: "/terms",
    label: "Terms",
    sidebarLabel: "Conditions of business",
    footerLabel: "Conditions of business",
    legal: true,
  },
  {
    href: "/privacy",
    label: "Privacy",
    sidebarLabel: "Privacy notice",
    footerLabel: "Privacy notice",
    legal: true,
  },
  {
    href: "/cookies",
    label: "Cookies",
    sidebarLabel: "Cookie policy",
    footerLabel: "Cookie policy",
    legal: true,
  },
  {
    href: "/shipping",
    label: "Shipping",
    sidebarLabel: "Shipping and logistics",
    footerLabel: "Shipping & logistics",
    legal: true,
  },
] as const;

export type PolicyRouteHref = (typeof policyRoutes)[number]["href"];

/** Legal policy documents, in canonical order (terms → privacy → cookies → shipping). */
export const legalPolicyRoutes: readonly PolicyRoute[] = policyRoutes.filter(
  (route) => route.legal,
);

/** Resolve the display label used in the footer / legal index. */
export function policyRouteLabel(route: PolicyRoute): string {
  return route.footerLabel ?? route.label;
}
