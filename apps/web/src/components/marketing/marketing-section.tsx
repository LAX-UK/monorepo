import { MarketingViewAllLink } from "@/components/marketing/marketing-view-all-link";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { MarketingSectionHeader } from "@auction/marketing-ui/marketing-section-header";
import { cn } from "@auction/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * The heading scale of a section. "page" is the home page's, "compact" the one a department page
 * uses for its rows. Both share the family rhythm, header, link and body spacing.
 */
export type MarketingSectionSize = "page" | "compact";

const HEADING_CLASS: Record<MarketingSectionSize, string> = {
  page: "text-2xl leading-[30px] md:text-[40px] md:leading-[48px]",
  compact: "text-2xl leading-[30px] md:text-[32px] md:leading-10",
};

const SUBTITLE_CLASS: Record<MarketingSectionSize, string> = {
  page: "text-base leading-6 md:text-lg",
  compact: "text-base leading-6",
};

export type MarketingSectionAction = {
  href: string;
  label: string;
  /** Screen-reader context read after the label (e.g. “sold in Prints”). */
  srSuffix?: string;
};

type Props = {
  /** Names the section; the heading's id is `${id}-heading`. */
  id: string;
  heading: string;
  subtitle?: string | undefined;
  /** The kit "View all" link on the heading's baseline. */
  action?: MarketingSectionAction | undefined;
  size?: MarketingSectionSize;
  children: ReactNode;
  className?: string;
};

/**
 * One titled row on a marketing page: the family rhythm (96px between sections on a desktop,
 * 64px on a phone), the shared section header with its kit link, and the section's body.
 */
export function MarketingSection({
  id,
  heading,
  subtitle,
  action,
  size = "page",
  children,
  className,
}: Props) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className={cn("pt-16 md:pt-24", className)}>
      <div className={MARKETING_PAGE_SHELL}>
        <MarketingSectionHeader
          heading={
            <h2
              id={headingId}
              className={cn(
                "font-headline font-medium tracking-[-0.01em] text-on-surface",
                HEADING_CLASS[size],
              )}
            >
              {heading}
            </h2>
          }
          subtitle={subtitle}
          subtitleClassName={SUBTITLE_CLASS[size]}
          action={
            action ? (
              <MarketingViewAllLink
                href={action.href}
                {...(action.srSuffix ? { srSuffix: action.srSuffix } : {})}
              >
                {action.label}
              </MarketingViewAllLink>
            ) : null
          }
        />
        <div className="mt-5 md:mt-8">{children}</div>
      </div>
    </section>
  );
}
