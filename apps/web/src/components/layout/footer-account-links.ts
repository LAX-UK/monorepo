import { usesBidAsClient } from "@/lib/auth/client-audience";
import type { SessionUser } from "@/lib/data/contracts";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { VISITOR_ALERTS_HREF } from "@/lib/marketing/mega-menu-catalog";
import { ACCOUNT_PRIMARY_ENTRIES } from "@/lib/navigation/account-menu-model";
import type { MarketingFooterLink } from "@auction/marketing-ui/marketing-footer";

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
