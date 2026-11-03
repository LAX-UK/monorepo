import { MarketingSection } from "@/components/marketing/marketing-section";
import { SELL_HOW_IT_WORKS_STEPS } from "@/lib/marketing/sell-how-it-works";
import { SELL_HOW_TO_SELL_PATH, SELL_SECTION_IDS } from "@/lib/marketing/sell-landing";

/** Three numbered steps, worded as on the home page, with the long guide one link away. */
export function SellSteps() {
  return (
    <MarketingSection
      id={SELL_SECTION_IDS.howItWorks}
      heading="How it works"
      action={{ href: SELL_HOW_TO_SELL_PATH, label: "Step by step guide" }}
    >
      <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
        {SELL_HOW_IT_WORKS_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-col gap-3 rounded-lg border border-border-hairline bg-surface-container-lowest p-5 md:p-6"
          >
            <span
              className="flex size-8 items-center justify-center rounded-full bg-surface-container-low font-label text-sm font-semibold tabular-nums text-on-surface"
              aria-hidden
            >
              {index + 1}
            </span>
            <h3 className="font-headline text-lg font-medium text-on-surface">{step.title}</h3>
            <p className="font-body text-sm leading-relaxed text-on-surface-variant">{step.body}</p>
          </li>
        ))}
      </ol>
    </MarketingSection>
  );
}
