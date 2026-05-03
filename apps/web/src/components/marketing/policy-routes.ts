export const policyRoutes = [
  { href: "/about", label: "About", sidebarLabel: "About" },
  { href: "/buy", label: "Buy", sidebarLabel: "Buying at LAX" },
  { href: "/sell", label: "Sell", sidebarLabel: "Selling with LAX" },
  { href: "/contact", label: "Contact", sidebarLabel: "Contact" },
  { href: "/faq", label: "FAQ", sidebarLabel: "FAQ" },
  { href: "/terms", label: "Terms", sidebarLabel: "Terms of sale" },
  { href: "/privacy", label: "Privacy", sidebarLabel: "Privacy" },
  { href: "/shipping", label: "Shipping", sidebarLabel: "Shipping" },
] as const;

export type PolicyRouteHref = (typeof policyRoutes)[number]["href"];
