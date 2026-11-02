import { VISITOR_ALERTS_HREF } from "@/lib/marketing/mega-menu-catalog";
import { PRIVATE_SALES_PATH } from "@/lib/marketing/private-sales";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { sellDepartmentsAnchorHref } from "@/lib/marketing/sell-departments";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { type MarketingFooterColumn, buildFooterLegalColumn } from "@auction/marketing-ui";

/** Footer entry rendered as the button that reopens the cookie settings dialog. */
export const BID_COOKIE_PREFERENCES_HREF = "#cookie-preferences";

/**
 * Shared LAX footer order: site navigation, account, LAX products, legal (Connect is appended by
 * the shell). The footer is the same for every visitor, so the Account column offers the ways in
 * and out of an account rather than reading the session.
 */
export function buildBidFooterColumns(
  crossProductLinks: readonly LaxProductLinkVm[],
): MarketingFooterColumn[] {
  const columns: MarketingFooterColumn[] = [
    {
      id: "auctions",
      title: "Auctions",
      links: [
        { href: calendarSalesHref({ tab: "upcoming" }), label: "Upcoming" },
        { href: "/results", label: "Results" },
        { href: "/artists", label: "Artists" },
        { href: "/search", label: "Search" },
        { href: "/buy", label: "How to buy" },
      ],
    },
    {
      id: "selling",
      title: "Selling",
      links: [
        { href: "/sell", label: "How to sell" },
        { href: sellIntakeHref(), label: "Submit a consignment" },
        { href: sellDepartmentsAnchorHref(), label: "Departments we review" },
        { href: PRIVATE_SALES_PATH, label: "Private sales" },
      ],
    },
    {
      id: "account",
      title: "Account",
      links: [
        { href: "/login", label: "Sign in" },
        { href: "/register", label: "Create account" },
        { href: VISITOR_ALERTS_HREF, label: "Auction alerts" },
        { href: "/contact", label: "Client services" },
        { href: "/faq", label: "FAQ" },
      ],
    },
    {
      id: "company",
      title: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/press", label: "Press" },
      ],
    },
  ];
  if (crossProductLinks.length > 0) {
    columns.push({
      id: "lax-products",
      title: "LAX products",
      links: crossProductLinks.map((link) => ({ href: link.href, label: link.label })),
    });
  }
  const legal = buildFooterLegalColumn({
    index: "/legal",
    terms: "/terms",
    privacy: "/privacy",
    cookies: "/cookies",
    cookiePreferences: BID_COOKIE_PREFERENCES_HREF,
  });
  if (legal) columns.push(legal);
  return columns;
}
