import { BID_COOKIE_PREFERENCES_HREF } from "@/components/layout/cookie-preferences-href";
import { PRIVATE_SALES_PATH } from "@/lib/marketing/private-sales";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { sellDepartmentsAnchorHref } from "@/lib/marketing/sell-departments";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { buildFooterLegalColumn } from "@auction/marketing-ui/footer-legal-column";
import type { MarketingFooterColumn } from "@auction/marketing-ui/marketing-footer";

/** The column whose links follow the session; the footer draws its list in the browser. */
export const BID_FOOTER_ACCOUNT_COLUMN_ID = "account";

/**
 * Shared LAX footer order: site navigation, account, LAX products, legal (Connect is appended by
 * the shell). The Account column carries no links here: they depend on who is signed in, so the
 * footer fills it from `bidFooterAccountLinks` in the browser.
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
        { href: sellDepartmentsAnchorHref(), label: "Departments" },
        { href: PRIVATE_SALES_PATH, label: "Private sales" },
      ],
    },
    { id: BID_FOOTER_ACCOUNT_COLUMN_ID, title: "Account", links: [] },
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
