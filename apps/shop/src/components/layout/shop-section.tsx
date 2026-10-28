import {
  MarketingSectionHeader,
  MarketingViewAllChevron,
  MarketingViewAllLink,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type ShopSectionProps = {
  id: string;
  title: string;
  subtitle?: ReactNode;
  viewAll?: {
    href: string;
    /** Visible text; defaults to "View all". */
    label?: string;
    /** Screen-reader destination after the label; defaults to the lowercased title. */
    srLabel?: string;
  };
  className?: string;
  children: ReactNode;
};

/**
 * A titled page section, built from the family's shared header and "View all" link exactly as
 * lax.art builds its sections: "View all" sits on the title's baseline at every width. The h2
 * labels the region for landmarks and heading order.
 */
export function ShopSection({
  id,
  title,
  subtitle,
  viewAll,
  className,
  children,
}: ShopSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-6", className)}>
      <MarketingSectionHeader
        heading={
          <h2
            id={headingId}
            className="m-0 font-headline text-[length:var(--text-title-section)] font-medium leading-[1.2] text-on-surface"
          >
            {title}
          </h2>
        }
        {...(subtitle ? { subtitle } : {})}
        {...(viewAll
          ? {
              action: (
                <MarketingViewAllLink asChild>
                  <Link href={viewAll.href}>
                    {viewAll.label ?? "View all"}
                    <span className="sr-only"> {viewAll.srLabel ?? title.toLowerCase()}</span>
                    <MarketingViewAllChevron />
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
