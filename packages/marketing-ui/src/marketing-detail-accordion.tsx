"use client";

import { cn } from "@auction/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@auction/ui/components/accordion";
import type { ReactNode } from "react";

export type MarketingDetailAccordionItem = {
  id: string;
  title: string;
  content: ReactNode;
};

export type MarketingDetailAccordionProps = {
  items: readonly MarketingDetailAccordionItem[];
  /** Item ids expanded on first render. */
  defaultOpen?: readonly string[];
  className?: string;
};

/** Bid lot-page accordion: hairline rules, label-caps triggers, body-copy panels. */
export function MarketingDetailAccordion({
  items,
  defaultOpen = [],
  className,
}: MarketingDetailAccordionProps) {
  if (items.length === 0) return null;
  return (
    <div className={cn("w-full border-t border-outline-variant/40", className)}>
      <Accordion type="multiple" defaultValue={[...defaultOpen]} className="w-full space-y-0">
        {items.map((item) => (
          <AccordionItem
            key={item.id}
            value={item.id}
            className="border-b border-outline-variant/40"
          >
            <AccordionTrigger className="min-h-11 py-4 text-left font-label text-sm font-semibold text-on-surface hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-on-surface">
              {item.title}
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-4 text-sm leading-7 text-on-surface-variant">{item.content}</div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
