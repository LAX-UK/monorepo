"use client";

import type { AccordionBlock } from "@/components/sections/artwork/artwork-view-models";
import { splitArtworkAccordionBlocks } from "@/components/sections/artwork/artwork-view-models";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  BodyText,
  cn,
} from "@auction/ui";
import type { ReactNode } from "react";

type LotDetailsSectionProps = {
  block: AccordionBlock | null;
  /** Tighter spacing for the online bid column (~440px). */
  compact?: boolean;
  className?: string;
};

/** Always-open LOT DETAILS block (extracted from `artworkCenter` accordion variant). */
export function LotDetailsSection({ block, compact = false, className }: LotDetailsSectionProps) {
  if (!block) return null;

  return (
    <section
      id="lot-details"
      className={cn(
        compact
          ? "mb-6 border-b border-outline-variant/40 pb-6"
          : "mb-8 border-b border-outline-variant/40 pb-8",
        className,
      )}
    >
      <h2
        className={cn(
          "mb-4 font-body font-medium uppercase tracking-wide text-on-surface",
          compact ? "text-base leading-6" : "text-lg leading-7",
        )}
      >
        LOT DETAILS
      </h2>
      <div className="text-sm leading-7 text-on-surface-variant">
        {block.contentNode != null ? block.contentNode : <BodyText>{block.content ?? ""}</BodyText>}
      </div>
    </section>
  );
}

type Props = {
  blocks: AccordionBlock[];
  /** e.g. bid history slot */
  extraItem?: { id: string; title: string; content: ReactNode } | null;
  /** Online artwork: first “lot details” block is always-open LOT DETAILS; rest stay accordion. */
  variant?: "default" | "artworkCenter";
};

export function LotMarketingAccordion({ blocks, extraItem = null, variant = "default" }: Props) {
  const visible = blocks.filter((b) => !b.hidden);
  if (visible.length === 0 && !extraItem) return null;

  if (variant === "artworkCenter") {
    const { lotDetails: lotDetailsBlock, accordionBlocks } = splitArtworkAccordionBlocks(blocks);

    return (
      <div className="w-full">
        <LotDetailsSection block={lotDetailsBlock} />

        {(accordionBlocks.length > 0 || extraItem) && (
          <div className="w-full border-t border-outline-variant/40 pt-0">
            <Accordion type="multiple" className="w-full space-y-0">
              {accordionBlocks.map((b) => (
                <AccordionItem
                  key={b.id}
                  value={b.id}
                  className="border-b border-outline-variant/40"
                >
                  <AccordionTrigger className="py-4 text-left font-['DM_Sans',sans-serif] text-sm font-semibold uppercase tracking-[0.1em] text-on-surface hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-on-surface">
                    {b.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    {b.contentNode != null ? (
                      <div className="pb-4 text-sm leading-7 text-on-surface-variant">
                        {b.contentNode}
                      </div>
                    ) : (
                      <BodyText className="pb-4 text-sm leading-7 text-on-surface-variant">
                        {b.content ?? ""}
                      </BodyText>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
              {extraItem ? (
                <AccordionItem value={extraItem.id} className="border-b border-outline-variant/40">
                  <AccordionTrigger className="py-4 text-left text-sm font-semibold uppercase tracking-[0.1em] text-on-surface hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-on-surface">
                    {extraItem.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">{extraItem.content}</div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}
            </Accordion>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px] border-t border-outline-variant/40">
      <Accordion type="multiple" className="w-full space-y-0">
        {visible.map((b) => (
          <AccordionItem key={b.id} value={b.id} className="border-b border-outline-variant/40">
            <AccordionTrigger className="py-4 text-left font-['DM_Sans',sans-serif] text-sm font-semibold uppercase tracking-[0.1em] text-on-surface hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-on-surface">
              {b.title}
            </AccordionTrigger>
            <AccordionContent>
              {b.contentNode != null ? (
                <div className="pb-4 text-sm leading-7 text-on-surface-variant">
                  {b.contentNode}
                </div>
              ) : (
                <BodyText className="pb-4 text-sm leading-7 text-on-surface-variant">
                  {b.content ?? ""}
                </BodyText>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
        {extraItem ? (
          <AccordionItem value={extraItem.id} className="border-b border-outline-variant/40">
            <AccordionTrigger className="py-4 text-left text-sm font-semibold uppercase tracking-[0.1em] text-on-surface hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-on-surface">
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
