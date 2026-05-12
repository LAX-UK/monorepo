import type { FooterLink } from "@/components/layout/footer-column";

/** Existing legacy groupings — kept exported so any future page can recompose
 * the historical layout without reaching back into the footer component.
 */
export const aboutLinks: FooterLink[] = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Conditions of Business" },
  { href: "/sitemap.xml", label: "Sitemap" },
];

export const serviceLinks: FooterLink[] = [
  { href: "/dashboard/submissions/new", label: "Sell with Us" },
  { href: "/contact", label: "Client services" },
  { href: "/archive", label: "Past auctions" },
];

export const policyLinks: FooterLink[] = [
  { href: "/privacy", label: "Privacy Notice" },
  { href: "/legal", label: "Legal" },
  { href: "/terms", label: "Conditions of Business" },
  { href: "/shipping", label: "Shipping & Logistics" },
];

/** Mockup-aligned groupings — additive; rendered as the default footer grid
 * but old groupings stay exported for callers that prefer them.
 */
export const auctionsLinks: FooterLink[] = [
  { href: "/", label: "Upcoming" },
  { href: "/archive", label: "Past auctions" },
  { href: "/artist/featured", label: "Artists" },
  { href: "/search", label: "Search" },
];

export const companyLinks: FooterLink[] = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/buy", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/faq", label: "FAQ" },
];

export const legalLinks: FooterLink[] = [
  { href: "/terms", label: "Conditions of Business" },
  { href: "/privacy", label: "Privacy Notice" },
  { href: "/shipping", label: "Shipping & Logistics" },
  { href: "/legal", label: "Legal" },
];

/** Mockup-aligned services column kept as a sibling for /shipping etc. */
export const servicesMockupLinks: FooterLink[] = serviceLinks;
