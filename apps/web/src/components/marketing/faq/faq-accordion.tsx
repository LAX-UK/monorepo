import type { FaqItem } from "@/components/marketing/faq/faq-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@auction/ui";

type FaqAccordionProps = {
  items: FaqItem[];
  /** Defaults to the first item's id when omitted. */
  defaultValue?: string;
};

/**
 * Historical accordion variant; preserved as a sibling to {@link FaqFlatList}
 * for any surface that prefers progressive disclosure (e.g. embedded help).
 */
export function FaqAccordion({ items, defaultValue }: FaqAccordionProps) {
  const initial = defaultValue ?? items[0]?.id;
  return (
    <Accordion
      type="single"
      collapsible
      className="border-t border-divider-soft"
      {...(initial ? { defaultValue: initial } : {})}
    >
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id} className="border-b border-divider-soft">
          <AccordionTrigger className="py-4 text-left font-headline text-lg font-semibold text-on-surface hover:no-underline">
            {item.title}
          </AccordionTrigger>
          <AccordionContent className="text-on-surface-variant">
            {item.bodyNode ?? item.body}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
