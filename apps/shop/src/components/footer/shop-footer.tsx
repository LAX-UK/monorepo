import { ShopAuthLink } from "@/components/shop-auth-link";
import type { ShopPolicySlug } from "@/content/policies/shop-policy-status";
import { isShopAuthHref } from "@/lib/is-shop-auth-href";
import type { ShopFooterAccountState } from "@/lib/shop-footer-account-state";
import { buildShopFooterVm } from "@/lib/shop-footer.vm";
import { FOCUS_RING, hasSocialProfiles, productCopyrightLine } from "@auction/branding";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { LaxLogo } from "@auction/marketing-ui";
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
  /** Policy pages that can be linked here; drafts hidden on production are left out. */
  linkablePolicies?: readonly ShopPolicySlug[];
};

const LINK_CLASS = cn(
  "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 underline-offset-4 hover:underline",
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
  linkablePolicies = [],
}: ShopFooterProps) {
  const vm = buildShopFooterVm({ crossProductLinks, accountState, linkablePolicies });
  return (
    <MarketingFooter
      headingId="shop-footer-heading"
      logo={
        <Link href="/" className={cn("inline-flex", FOCUS_RING)} aria-label="LAX Shop home">
          <LaxLogo kind="shop-exchange" className="shop-footer__logo" />
        </Link>
      }
      columns={vm.columns}
      socials={hasSocialProfiles("shop") ? <MarketingFooterSocials product="shop" /> : undefined}
      copyright={productCopyrightLine("shop")}
      renderLink={renderLink}
    />
  );
}
