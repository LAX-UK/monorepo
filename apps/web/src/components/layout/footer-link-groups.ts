import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { sellDepartmentsAnchorHref } from "@/lib/marketing/sell-departments";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { type MarketingFooterColumn, buildFooterLegalColumn } from "@auction/marketing-ui";

/** Footer entry rendered as the button that reopens the cookie preferences dialog. */
export const BID_COOKIE_PREFERENCES_HREF = "#cookie-preferences";

/** Shared LAX footer order: site navigation, LAX products, legal (Connect is appended by the shell). */
export function buildBidFooterColumns(
  crossProductLinks: readonly LaxProductLinkVm[],
): MarketingFooterColumn[] {
  const columns: MarketingFooterColumn[] = [
    {
      id: "auctions",
      title: "Auctions",
      links: [
        { href: calendarSalesHref({ tab: "upcoming" }), label: "Upcoming" },
        { href: "/results", label: "Past auctions" },
        { href: "/artists", label: "Artists" },
        { href: "/search", label: "Search" },
      ],
    },
    {
      id: "services",
      title: "Services",
      links: [
        { href: "/buy", label: "How to buy" },
        { href: "/sell", label: "How to sell" },
        { href: sellIntakeHref(), label: "Submit a consignment" },
        { href: sellDepartmentsAnchorHref(), label: "Departments we review" },
        { href: "/contact", label: "Client services" },
      ],
    },
    {
      id: "company",
      title: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/press", label: "Press" },
        { href: "/faq", label: "FAQ" },
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
