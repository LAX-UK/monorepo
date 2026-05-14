export const policyRoutes = [
  { href: "/about", label: "About", sidebarLabel: "About" },
  { href: "/buy", label: "Buy", sidebarLabel: "Buying at LAX.BID" },
  { href: "/sell", label: "Sell", sidebarLabel: "Selling with LAX.BID" },
  { href: "/contact", label: "Contact", sidebarLabel: "Contact" },
  { href: "/faq", label: "FAQ", sidebarLabel: "FAQ" },
  { href: "/terms", label: "Terms", sidebarLabel: "Conditions of Business" },
  { href: "/privacy", label: "Privacy", sidebarLabel: "Privacy Notice" },
  { href: "/cookies", label: "Cookies", sidebarLabel: "Cookie Policy" },
  { href: "/shipping", label: "Shipping", sidebarLabel: "Shipping & Logistics" },
] as const;

export type PolicyRouteHref = (typeof policyRoutes)[number]["href"];
