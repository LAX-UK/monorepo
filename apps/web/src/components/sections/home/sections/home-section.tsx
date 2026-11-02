import { MarketingViewAllLink } from "@/components/marketing/marketing-view-all-link";
import type { HomeLink } from "@/lib/home-sections/types";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { MarketingSectionHeader } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  /** Anchors the heading for the section's accessible name. */
  id: string;
  heading: string;
  subtitle?: string | undefined;
  /** The kit "View all" link on the heading's baseline. */
  action?: HomeLink | undefined;
  children: ReactNode;
  className?: string;
};

/**
 * One home section: the family rhythm (96px between sections on a desktop, 64px on a phone),
 * the shared section header with its kit link, and the section's body.
 */
export function HomeSection({ id, heading, subtitle, action, children, className }: Props) {
  const headingId = `home-${id}-heading`;
  return (
    <section aria-labelledby={headingId} className={cn("pt-16 md:pt-24", className)}>
      <div className={MARKETING_PAGE_SHELL}>
        <MarketingSectionHeader
          heading={
            <h2
              id={headingId}
              className="font-headline text-2xl font-medium leading-[30px] tracking-[-0.01em] text-on-surface md:text-[40px] md:leading-[48px]"
            >
              {heading}
            </h2>
          }
          subtitle={subtitle}
          subtitleClassName="text-base leading-6 md:text-lg"
          action={
            action ? (
              <MarketingViewAllLink href={action.href}>{action.label}</MarketingViewAllLink>
            ) : null
          }
        />
        <div className="mt-5 md:mt-8">{children}</div>
      </div>
    </section>
  );
}
