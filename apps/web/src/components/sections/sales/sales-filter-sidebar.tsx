"use client";

import {
  SalesFilterGroupContents,
  salesFilterAccordionContentClass,
} from "@/components/sections/sales/sales-filter-group-contents";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { SALES_FILTER_SIDEBAR_GROUPS } from "@/lib/marketing/sales-filter-sidebar-catalog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, cn } from "@auction/ui";
import { useState } from "react";

type Category = { id: string; name: string };

type Props = {
  state: CalendarSalesUrlState;
  resultCount: number;
  categories: Category[];
  years: number[];
  className?: string;
};

const itemBorderClass = "border-b border-outline-variant dark:border-outline-variant/30";
const triggerClass =
  "py-4 font-body text-base font-medium text-on-surface hover:no-underline dark:text-on-surface";

export function SalesFilterSidebar({ state, resultCount, categories, years, className }: Props) {
  const [openSections, setOpenSections] = useState<string[]>([]);

  return (
    <aside
      className={cn(
        "w-full shrink-0 border-outline-variant pb-4 dark:border-outline-variant/30 lg:border-r lg:w-[min(100%,441px)] lg:max-w-[441px] lg:pr-8",
        className,
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5 border-b border-outline-variant pb-4 dark:border-outline-variant/30">
          <p
            className="flex-1 font-body text-sm font-normal uppercase leading-6 text-on-surface-variant"
            aria-live="polite"
            aria-atomic="true"
          >
            Showing {resultCount} Result{resultCount === 1 ? "" : "s"}
          </p>
        </div>

        <Accordion
          type="multiple"
          className="w-full"
          value={openSections}
          onValueChange={setOpenSections}
        >
          {SALES_FILTER_SIDEBAR_GROUPS.map((g) => (
            <AccordionItem key={g.value} value={g.value} className={itemBorderClass}>
              <AccordionTrigger className={triggerClass}>{g.title}</AccordionTrigger>
              <AccordionContent className={salesFilterAccordionContentClass[g.value]}>
                <SalesFilterGroupContents
                  group={g.value}
                  state={state}
                  categories={categories}
                  years={years}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </aside>
  );
}
