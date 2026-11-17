import { ArtAuthLink } from "@/components/art-auth-link";
import { isArtAuthHref } from "@/lib/is-art-auth-href";
import { FOCUS_RING } from "@auction/branding";
import type { MarketingFooterLink } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

const LINK_CLASS = cn(
  "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-link",
  FOCUS_RING,
);

/** One footer link: auth routes skip prefetch, in-page and external links are plain anchors. */
export function ArtFooterLink({ link }: { link: MarketingFooterLink }) {
  if (isArtAuthHref(link.href)) {
    return (
      <ArtAuthLink href={link.href} className={LINK_CLASS}>
        {link.label}
      </ArtAuthLink>
    );
  }
  if (link.href.startsWith("#")) {
    return (
      <a href={link.href} className={LINK_CLASS}>
        {link.label}
      </a>
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
