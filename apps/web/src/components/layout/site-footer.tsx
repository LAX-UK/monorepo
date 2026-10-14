import {
  BID_COOKIE_PREFERENCES_HREF,
  buildBidFooterColumns,
} from "@/components/layout/footer-link-groups";
import { FooterNavLink } from "@/components/layout/footer-nav-link";
import { FooterSocials } from "@/components/layout/footer-socials";
import { LaxLogo } from "@/components/layout/lax-logo";
import { CookiePreferencesLink } from "@/components/marketing/consent/cookie-preferences-link";
import { siteCopyrightLine } from "@/lib/brand";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { MarketingFooter, type MarketingFooterLink } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type SiteFooterProps = {
  /** Cross-product wayfinding (validated at composition root). */
  crossProductLinks?: LaxProductLinkVm[];
};

const LINK_CLASS = cn(
  "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-link",
  FOCUS_RING,
);

function renderLink(link: MarketingFooterLink) {
  if (link.href === BID_COOKIE_PREFERENCES_HREF) {
    return <CookiePreferencesLink className="min-h-0 leading-6" />;
  }
  if (link.href.startsWith("http://") || link.href.startsWith("https://")) {
    return (
      <a href={link.href} className={LINK_CLASS} rel="noopener noreferrer">
        {link.label}
      </a>
    );
  }
  return <FooterNavLink href={link.href} label={link.label} className={LINK_CLASS} />;
}

export function SiteFooter({ crossProductLinks = [] }: SiteFooterProps = {}) {
  return (
    <MarketingFooter
      headingId="bid-footer-heading"
      logo={
        <Link href="/" className={cn("inline-flex", FOCUS_RING)} aria-label="LAX Bid home">
          <LaxLogo variant="footer" />
        </Link>
      }
      columns={buildBidFooterColumns(crossProductLinks)}
      socials={<FooterSocials />}
      copyright={siteCopyrightLine()}
      renderLink={renderLink}
    />
  );
}
