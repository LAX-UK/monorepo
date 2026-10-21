"use client";

import { AccordionContent, AccordionItem, AccordionTrigger, cn } from "@auction/ui";
import type { ReactNode } from "react";
import { MARKETING_FILTER_ACCORDION_TRIGGER } from "./catalog-filter-rail.js";
import {
  MarketingFilterOptionList,
  type MarketingFilterOptionListProps,
} from "./marketing-filter-option-list.js";

export type MarketingFilterAccordionSectionProps = {
  /** Accordion item value; the parent `Accordion type="multiple"` controls which are open. */
  value: string;
  title: string;
  children: ReactNode;
  className?: string;
};

/** One collapsible facet in a filter drawer or sheet (Figma 541:6507 / 551:10071). */
export function MarketingFilterAccordionSection({
  value,
  title,
  children,
  className,
}: MarketingFilterAccordionSectionProps) {
  return (
    <AccordionItem value={value} className={cn("border-b border-border-hairline", className)}>
      <AccordionTrigger className={cn(MARKETING_FILTER_ACCORDION_TRIGGER, "min-h-11 items-center")}>
        {title}
      </AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

export type MarketingFilterFacetGroupProps = Omit<
  MarketingFilterOptionListProps,
  "legend" | "className"
> & {
  value: string;
  title: string;
};

/** Accordion section holding a checkbox (or radio) facet; edits a draft the parent applies. */
export function MarketingFilterFacetGroup({
  value,
  title,
  ...listProps
}: MarketingFilterFacetGroupProps) {
  return (
    <MarketingFilterAccordionSection value={value} title={title}>
      <MarketingFilterOptionList legend={title} {...listProps} />
    </MarketingFilterAccordionSection>
  );
}
