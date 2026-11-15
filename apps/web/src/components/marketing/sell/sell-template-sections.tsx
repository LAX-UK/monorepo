import type { FaqItem } from "@/components/marketing/faq/faq-data";
import { SellClosingCta } from "@/components/marketing/sell/sell-closing-cta";
import { SellFaq } from "@/components/marketing/sell/sell-faq";
import { SellFees } from "@/components/marketing/sell/sell-fees";
import { SellSpecialistsSection } from "@/components/marketing/sell/sell-specialists-section";
import { SellSteps } from "@/components/marketing/sell/sell-steps";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { sellContactHref } from "@/lib/marketing/sell-intake";
import type { SellSpecialist } from "@/lib/marketing/sell-specialists";
import type { ReactNode } from "react";

type Props = {
  specialists: readonly SellSpecialist[];
  faqItems: readonly FaqItem[];
  /** Analytics source of the closing "Sell a work" link. */
  closingSource: string;
  categorySlug?: string;
  contactType?: Parameters<typeof sellContactHref>[0];
  /** A line under the closing buttons. */
  closingFootnote?: ReactNode;
  /** Rendered between the steps and the fees (the landing shows its department grid here). */
  afterSteps?: ReactNode;
};

/**
 * The selling template after the hero: steps, fees, specialists, questions and the closing call
 * to action. The landing and every department page render this one sequence.
 */
export function SellTemplateSections({
  specialists,
  faqItems,
  closingSource,
  categorySlug,
  contactType,
  closingFootnote,
  afterSteps,
}: Props) {
  return (
    <>
      <SellSteps />
      {afterSteps}
      <SellFees />
      <SellSpecialistsSection specialists={specialists} />
      <SellFaq items={faqItems} />
      <section className={`${MARKETING_PAGE_SHELL} py-16 md:py-24`}>
        <SellClosingCta
          source={closingSource}
          footnote={closingFootnote}
          {...(categorySlug ? { categorySlug } : {})}
          {...(contactType ? { contactType } : {})}
        />
      </section>
    </>
  );
}
