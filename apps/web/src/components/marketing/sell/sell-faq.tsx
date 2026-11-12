import type { FaqItem } from "@/components/marketing/faq/faq-data";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SELL_SECTION_IDS } from "@/lib/marketing/sell-landing";
import { MarketingDetailAccordion } from "@auction/marketing-ui/marketing-detail-accordion";

type Props = { items: readonly FaqItem[] };

/** The questions sellers ask most, from the shared FAQ. */
export function SellFaq({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <MarketingSection
      id={SELL_SECTION_IDS.faq}
      heading="Questions"
      action={{ href: "/faq", label: "All questions" }}
    >
      <MarketingDetailAccordion
        items={items.map((item) => ({ id: item.id, title: item.title, content: item.body }))}
      />
    </MarketingSection>
  );
}
