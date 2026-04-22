"use client";

import type { AccordionBlock } from "@/components/sections/artwork/artwork-view-models";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  BodyText,
} from "@auction/ui";
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
            <AccordionTrigger className="py-0 text-left font-['DM_Sans',sans-serif] text-lg font-medium uppercase leading-[21px] text-on-surface hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-on-surface">
              {b.title}
            </AccordionTrigger>
            <AccordionContent>
              {b.contentNode != null ? (
                <div className="pt-4 text-sm leading-[135%] text-on-surface dark:text-brand-500">
                  {b.contentNode}
                </div>
              ) : (
                <BodyText className="pt-4 text-sm leading-[135%] text-on-surface dark:text-brand-500">
                  {b.content ?? ""}
                </BodyText>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
        {extraItem ? (
          <AccordionItem value={extraItem.id} className="border-0">
            <AccordionTrigger className="py-0 text-left text-lg font-medium uppercase text-on-surface hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-on-surface">
              {extraItem.title}
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
