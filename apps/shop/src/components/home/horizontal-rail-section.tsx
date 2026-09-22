import { ShopSectionHeader } from "@/components/home/shop-section-header";
import type { HomeSectionLink } from "@/content/home-marketing";
import { MarketingHorizontalRail } from "@auction/marketing-ui";
import { Children, type ReactNode } from "react";

type HorizontalRailSectionProps = HomeSectionLink & {
  sectionId?: string;
  headingId: string;
  scrollRegionId: string;
  controlsLabel: string;
  forwardAriaLabel: string;
  rowClassName: string;
  children: ReactNode;
  emptyState?: ReactNode;
};

export function HorizontalRailSection({
  sectionId,
  headingId,
  scrollRegionId,
  controlsLabel,
  forwardAriaLabel,
  rowClassName,
  children,
  emptyState,
  ...header
}: HorizontalRailSectionProps) {
  const hasChildren = Children.count(children) > 0;

  return (
    <section id={sectionId} className="shop-home__section" aria-labelledby={headingId}>
      <ShopSectionHeader headingId={headingId} {...header} />
      {hasChildren ? (
        <MarketingHorizontalRail
          id={scrollRegionId}
          ariaLabel={controlsLabel}
          forwardAriaLabel={forwardAriaLabel}
          scrollerAs="section"
          scrollerClassName={`${rowClassName} shop-focus-ring`}
        >
          {children}
        </MarketingHorizontalRail>
      ) : (
        <output className="shop-home__rail-state" aria-live="polite" aria-atomic="true">
          {emptyState ?? null}
        </output>
      )}
    </section>
  );
}
