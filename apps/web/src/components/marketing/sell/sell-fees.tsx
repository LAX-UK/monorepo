import { MarketingSection } from "@/components/marketing/marketing-section";
import { SELL_FEES_POINTS, SELL_SECTION_IDS, sellTrustLine } from "@/lib/marketing/sell-landing";

/** What selling costs, in plain words, and who stands behind it. */
export function SellFees() {
  return (
    <MarketingSection id={SELL_SECTION_IDS.fees} heading="Fees in plain words">
      <ul className="grid gap-x-10 gap-y-0 md:grid-cols-2">
        {SELL_FEES_POINTS.map((point) => (
          <li
            key={point}
            className="border-t border-border-hairline py-4 font-body text-base leading-relaxed text-on-surface"
          >
            {point}
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-[45rem] font-body text-sm leading-relaxed text-on-surface-variant">
        {sellTrustLine()}
      </p>
    </MarketingSection>
  );
}
