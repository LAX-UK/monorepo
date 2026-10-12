import { isSafeEditorialHref } from "@auction/shop-contracts";
import Link from "next/link";
import type { ReactNode } from "react";

type ArtEditorialLinkProps = {
  href: string | null | undefined;
  className?: string;
  children: ReactNode;
};

/**
 * Single choke point for CMS-authored links: unsafe or missing hrefs render as plain text,
 * site paths use client navigation, external https links open in a new tab.
 */
export function ArtEditorialLink({ href, className, children }: ArtEditorialLinkProps) {
  if (!isSafeEditorialHref(href)) {
    return <span className={className}>{children}</span>;
  }
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
