import { MarketingSectionHeader, MarketingViewAllLink } from "@auction/marketing-ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type ArtSectionProps = {
  id: string;
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  children: ReactNode;
};

/** Titled page section; the h2 labels the region for landmarks and heading order. */
export function ArtSection({ id, title, subtitle, viewAllHref, children }: ArtSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <MarketingSectionHeader
        heading={
          <h2
            id={headingId}
            className="font-headline text-[length:var(--text-title-section)] font-semibold text-on-surface"
          >
            {title}
          </h2>
        }
        {...(subtitle ? { subtitle } : {})}
        {...(viewAllHref
          ? {
              action: (
                <MarketingViewAllLink asChild>
                  <Link href={viewAllHref}>
                    See all<span className="sr-only"> {title.toLowerCase()}</span>
                  </Link>
                </MarketingViewAllLink>
              ),
            }
          : {})}
      />
      {children}
    </section>
  );
}
