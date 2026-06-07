import type { FooterLink } from "@/components/layout/footer-column";
import { footerLegalRoutes, policyRouteLabel } from "@/components/marketing/policy-routes";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { sellDepartmentsAnchorHref } from "@/lib/marketing/sell-departments";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";

export const serviceLinks: FooterLink[] = [
  { href: sellIntakeHref(), label: "Sell with Us" },
  { href: sellDepartmentsAnchorHref(), label: "Departments we review" },
  { href: "/contact", label: "Client services" },
  { href: "/archive", label: "Past auctions" },
];

/** Mockup-aligned groupings — additive; rendered as the default footer grid
 * but old groupings stay exported for callers that prefer them.
 */
export const auctionsLinks: FooterLink[] = [
  { href: calendarSalesHref({ tab: "upcoming" }), label: "Upcoming" },
  { href: "/archive", label: "Past auctions" },
  { href: "/artists", label: "Artists" },
  { href: "/search", label: "Search" },
];

export const companyLinks: FooterLink[] = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/buy", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/faq", label: "FAQ" },
];

export const legalLinks: FooterLink[] = footerLegalRoutes.map((route) => ({
  href: route.href,
  label: policyRouteLabel(route),
}));

/** Mockup-aligned services column kept as a sibling for /shipping etc. */
export const servicesMockupLinks: FooterLink[] = serviceLinks;
