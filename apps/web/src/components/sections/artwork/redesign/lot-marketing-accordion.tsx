"use client";

import type { AccordionBlock } from "@/components/sections/artwork/artwork-view-models";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  BodyText,
} from "@auction/ui";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  blocks: AccordionBlock[];
  /** e.g. bid history slot */
  extraItem?: { id: string; title: string; content: ReactNode } | null;
};

export function LotMarketingAccordion({ blocks, extraItem = null }: Props) {
  const visible = blocks.filter((b) => !b.hidden);
  if (visible.length === 0 && !extraItem) return null;

  return (
    <div className="w-full max-w-[1376px]">
      <Accordion type="multiple" className="w-full space-y-0">
        {visible.map((b) => (
          <AccordionItem key={b.id} value={b.id} className="border-0">
            <AccordionTrigger className="py-0 text-left font-['DM_Sans',sans-serif] text-lg font-medium uppercase leading-[21px] text-[#1C170D] hover:no-underline dark:text-on-surface [&>svg]:hidden">
              <span className="flex w-full items-center justify-between gap-2">
                {b.title}
                <ChevronDown
                  className="size-5 shrink-0 text-[#0A0A0A] transition-transform duration-200 data-[state=open]:rotate-180 dark:text-on-surface"
                  aria-hidden
                />
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <BodyText className="pt-4 text-sm leading-[135%] text-[#191919] dark:text-brand-500">
                {b.content}
              </BodyText>
            </AccordionContent>
          </AccordionItem>
        ))}
        {extraItem ? (
          <AccordionItem value={extraItem.id} className="border-0">
            <AccordionTrigger className="py-0 text-left text-lg font-medium uppercase text-[#1C170D] dark:text-on-surface [&>svg]:hidden">
              <span className="flex w-full items-center justify-between gap-2">
                {extraItem.title}
                <ChevronDown
                  className="size-5 shrink-0 text-[#0A0A0A] transition-transform duration-200 data-[state=open]:rotate-180 dark:text-on-surface"
                  aria-hidden
                />
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">{extraItem.content}</div>
            </AccordionContent>
          </AccordionItem>
        ) : null}
      </Accordion>
    </div>
  );
}
