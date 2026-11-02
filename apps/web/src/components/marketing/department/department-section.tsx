import { MarketingViewAllLink } from "@/components/marketing/marketing-view-all-link";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { MarketingSectionHeader } from "@auction/marketing-ui";
import type { ReactNode } from "react";

type Props = {
  id: string;
  heading: string;
  subtitle?: string;
  action?: { href: string; label: string; srSuffix: string };
  children: ReactNode;
};

/** One titled row on a department page: the shared section header, its link and the body. */
export function DepartmentSection({ id, heading, subtitle, action, children }: Props) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="pt-16 md:pt-24">
      <div className={MARKETING_PAGE_SHELL}>
        <MarketingSectionHeader
          heading={
            <h2
              id={headingId}
              className="font-headline text-2xl font-medium leading-[30px] tracking-[-0.01em] text-on-surface md:text-[32px] md:leading-10"
            >
              {heading}
            </h2>
          }
          subtitle={subtitle}
          subtitleClassName="text-base leading-6"
          action={
            action ? (
              <MarketingViewAllLink href={action.href} srSuffix={action.srSuffix}>
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
