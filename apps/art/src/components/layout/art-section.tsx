import {
  MarketingSectionHeader,
  MarketingViewAllChevron,
  MarketingViewAllLink,
} from "@auction/marketing-ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type ArtSectionHeaderProps = {
  /** The heading's id; the section that holds it is labelled by it. */
  headingId: string;
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  /** Screen-reader destination after "View all"; defaults to the lowercased title. */
  viewAllSrLabel?: string;
};

/** The section title with its optional "View all", for sections that lay out their own body. */
export function ArtSectionHeader({
  headingId,
  title,
  subtitle,
  viewAllHref,
  viewAllSrLabel,
}: ArtSectionHeaderProps) {
  return (
    <MarketingSectionHeader
      heading={
        <h2
          id={headingId}
          className="font-headline text-[length:var(--text-title-section)] font-medium leading-[1.2] text-on-surface"
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
                  View all
                  <span className="sr-only"> {viewAllSrLabel ?? title.toLowerCase()}</span>
                  <MarketingViewAllChevron />
                </Link>
              </MarketingViewAllLink>
            ),
          }
        : {})}
    />
  );
}

export type ArtSectionProps = Omit<ArtSectionHeaderProps, "headingId"> & {
  id: string;
  children: ReactNode;
};

/** Titled page section; the h2 labels the region for landmarks and heading order. */
export function ArtSection({ id, children, ...header }: ArtSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <ArtSectionHeader headingId={headingId} {...header} />
      {children}
    </section>
  );
}
