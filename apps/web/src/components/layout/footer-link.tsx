import { BID_COOKIE_PREFERENCES_HREF } from "@/components/layout/cookie-preferences-href";
import { FooterNavLink } from "@/components/layout/footer-nav-link";
import { CookiePreferencesLink } from "@/components/marketing/consent/cookie-preferences-link";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { MarketingFooterLink } from "@auction/marketing-ui/marketing-footer";
import { cn } from "@auction/ui/lib/utils";

export const FOOTER_LINK_CLASS = cn(
  "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-link",
  FOCUS_RING,
);

/**
 * One footer link: the cookie settings button, an external address as a plain anchor, anything
 * else as a link that marks the page the visitor is on. Draws the same on the server and in the
 * browser, so a column can be built in either.
 */
export function FooterLink({ link }: { link: MarketingFooterLink }) {
  if (link.href === BID_COOKIE_PREFERENCES_HREF) {
    return <CookiePreferencesLink className="min-h-0 text-base font-medium leading-6" />;
  }
  if (link.href.startsWith("http://") || link.href.startsWith("https://")) {
    return (
      <a href={link.href} className={FOOTER_LINK_CLASS} rel="noopener noreferrer">
        {link.label}
      </a>
    );
  }
  return <FooterNavLink href={link.href} label={link.label} className={FOOTER_LINK_CLASS} />;
}
