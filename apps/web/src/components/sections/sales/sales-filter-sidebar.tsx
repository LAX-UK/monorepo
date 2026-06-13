"use client";

import { MarketingFilterSidebar } from "@/components/marketing/marketing-filter-sidebar";
import {
  SalesFilterGroupContents,
  salesFilterAccordionContentClass,
} from "@/components/sections/sales/sales-filter-group-contents";
import {
  MARKETING_FILTER_ACCORDION_TRIGGER,
  MARKETING_FILTER_RAIL_STICKY,
  MARKETING_FILTER_RESULT_COUNT,
} from "@/lib/marketing/filter-rail";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import {
  SALES_FILTER_SIDEBAR_DEFAULT_OPEN,
  SALES_FILTER_SIDEBAR_GROUPS,
} from "@/lib/marketing/sales-filter-sidebar-catalog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, cn } from "@auction/ui";
import { useState } from "react";

type Category = { id: string; name: string };

type Props = {
  state: CalendarSalesUrlState;
  resultCount: number;
  categories: Category[];
  years: number[];
  className?: string;
  showResultCount?: boolean;
  onLinkClick?: () => void;
};

const itemBorderClass = "border-b border-outline-variant dark:border-outline-variant/30";

export function SalesFilterSidebar({
  state,
  resultCount,
  categories,
  years,
  className,
  showResultCount = true,
  onLinkClick,
}: Props) {
  const [openSections, setOpenSections] = useState<string[]>(SALES_FILTER_SIDEBAR_DEFAULT_OPEN);

  return (
    <MarketingFilterSidebar
      className={cn(
        "space-y-4 pb-0 lg:border-outline-variant dark:lg:border-outline-variant/30",
        MARKETING_FILTER_RAIL_STICKY,
        className,
      )}
    >
      {showResultCount ? (
        <div className="border-b border-outline-variant pb-3 dark:border-outline-variant/30">
          <p className={MARKETING_FILTER_RESULT_COUNT} aria-live="polite" aria-atomic="true">
            Showing {resultCount} Result{resultCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      <Accordion
        type="multiple"
        className="w-full"
        value={openSections}
        onValueChange={setOpenSections}
      >
        {SALES_FILTER_SIDEBAR_GROUPS.map((g) => (
          <AccordionItem key={g.value} value={g.value} className={itemBorderClass}>
            <AccordionTrigger className={MARKETING_FILTER_ACCORDION_TRIGGER}>
              {g.title}
            </AccordionTrigger>
            <AccordionContent className={salesFilterAccordionContentClass[g.value]}>
              <SalesFilterGroupContents
                group={g.value}
                state={state}
                categories={categories}
                years={years}
                {...(onLinkClick ? { onLinkClick } : {})}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </MarketingFilterSidebar>
  );
}
