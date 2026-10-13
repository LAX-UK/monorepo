import { ArtAuthLink } from "@/components/art-auth-link";
import { isArtAuthHref } from "@/lib/is-art-auth-href";
import type { ArtFooterVm } from "@/lib/layout/art-footer.vm";
import { FOCUS_RING, siteCopyrightLine } from "@auction/branding";
import {
  LaxLogo,
  MarketingFooter,
  type MarketingFooterLink,
  MarketingFooterSocials,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type ArtFooterProps = {
  vm: ArtFooterVm;
};

export function ArtFooter({ vm }: ArtFooterProps) {
  const linkClass = cn(
    "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-link",
    FOCUS_RING,
  );

  const renderLink = (link: MarketingFooterLink) => {
    if (isArtAuthHref(link.href)) {
      return (
        <ArtAuthLink href={link.href} className={linkClass}>
          {link.label}
        </ArtAuthLink>
      );
    }
    if (link.href.startsWith("#")) {
      return (
        <a href={link.href} className={linkClass}>
          {link.label}
        </a>
      );
    }
    if (link.href.startsWith("http://") || link.href.startsWith("https://")) {
      return (
        <a href={link.href} className={linkClass} rel="noopener noreferrer">
          {link.label}
        </a>
      );
    }
    return (
      <Link href={link.href} className={linkClass}>
        {link.label}
      </Link>
    );
  };

  return (
    <MarketingFooter
      logo={
        <Link href="/" className={cn("inline-flex", FOCUS_RING)} aria-label="LAX Art home">
          <LaxLogo variant="footer" src="/brand/lax-logo.svg" className="art-footer__logo" />
        </Link>
      }
      tagline={vm.tagline}
      columns={vm.columns}
      socials={<MarketingFooterSocials />}
      copyright={siteCopyrightLine()}
      renderLink={renderLink}
    />
  );
}
