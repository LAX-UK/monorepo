import { ShopLaxLogo } from "@/components/layout/shop-lax-logo";
import { ShopAuthLink } from "@/components/shop-auth-link";
import { isShopAuthHref } from "@/lib/is-shop-auth-href";
import type { ShopFooterAccountState } from "@/lib/shop-footer-account-state";
import { buildShopFooterVm } from "@/lib/shop-footer.vm";
import { FOCUS_RING, siteCopyrightLine } from "@auction/branding";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  MarketingFooter,
  type MarketingFooterLink,
  MarketingFooterSocials,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type ShopFooterProps = {
  crossProductLinks?: LaxProductLinkVm[];
  accountState?: ShopFooterAccountState;
};

const LINK_CLASS = cn(
  "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-link",
  FOCUS_RING,
);

function renderLink(link: MarketingFooterLink) {
  if (isShopAuthHref(link.href)) {
    return (
      <ShopAuthLink href={link.href} className={LINK_CLASS}>
        {link.label}
      </ShopAuthLink>
    );
  }
  if (link.href.startsWith("http://") || link.href.startsWith("https://")) {
    return (
      <a href={link.href} className={LINK_CLASS} rel="noopener noreferrer">
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={LINK_CLASS}>
      {link.label}
    </Link>
  );
}

export function ShopFooter({
  crossProductLinks = [],
  accountState = { kind: "guest" },
}: ShopFooterProps) {
  const vm = buildShopFooterVm({ crossProductLinks, accountState });
  return (
    <MarketingFooter
      headingId="shop-footer-heading"
      logo={
        <Link href="/" className={cn("inline-flex", FOCUS_RING)} aria-label="LAX Shop home">
          <ShopLaxLogo variant="footer" className="shop-footer__logo" />
        </Link>
      }
      columns={vm.columns}
      socials={<MarketingFooterSocials />}
      copyright={siteCopyrightLine()}
      renderLink={renderLink}
    />
  );
}
