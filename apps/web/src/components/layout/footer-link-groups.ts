import { usesBidAsClient } from "@/lib/auth/client-audience";
import type { SessionUser } from "@/lib/data/contracts";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { VISITOR_ALERTS_HREF } from "@/lib/marketing/mega-menu-catalog";
import { PRIVATE_SALES_PATH } from "@/lib/marketing/private-sales";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { sellDepartmentsAnchorHref } from "@/lib/marketing/sell-departments";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { ACCOUNT_PRIMARY_ENTRIES } from "@/lib/navigation/account-menu-model";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { buildFooterLegalColumn } from "@auction/marketing-ui/footer-legal-column";
import type {
  MarketingFooterColumn,
  MarketingFooterLink,
} from "@auction/marketing-ui/marketing-footer";

/** Footer entry rendered as the button that reopens the cookie settings dialog. */
export const BID_COOKIE_PREFERENCES_HREF = "#cookie-preferences";

/** The person the Account column is built for; `null` is a visitor. */
export type FooterAccountPerson = Pick<SessionUser, "role" | "staffRoles"> | null;

/** Help every visitor can reach, signed in or not. */
const HELP_LINKS: readonly MarketingFooterLink[] = [
  { href: "/contact", label: "Client services" },
  { href: "/faq", label: "FAQ" },
];

/**
 * The Account column follows the session: the ways in for a visitor, a client's everyday pages
 * once signed in, and LAX Account for staff, who have no client pages. Help stays in every state.
 */
export function bidFooterAccountLinks(person: FooterAccountPerson): MarketingFooterLink[] {
  if (!person) {
    return [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
      { href: VISITOR_ALERTS_HREF, label: "Auction alerts" },
      ...HELP_LINKS,
    ];
  }
  const own: MarketingFooterLink[] = usesBidAsClient(person)
    ? ACCOUNT_PRIMARY_ENTRIES.map(({ href, label }) => ({ href, label }))
    : [{ href: laxAccountHomeUrl(), label: "LAX Account" }];
  return [...own, ...HELP_LINKS];
}

/**
 * Shared LAX footer order: site navigation, account, LAX products, legal (Connect is appended by
 * the shell). Pass the signed-in person to show their pages in the Account column; without one it
 * offers the ways in.
 */
export function buildBidFooterColumns(
  crossProductLinks: readonly LaxProductLinkVm[],
  person: FooterAccountPerson = null,
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
    { id: "account", title: "Account", links: bidFooterAccountLinks(person) },
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
