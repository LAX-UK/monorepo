import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import {
  SELL_VALUATION_CTA_LABEL,
  SellValuationIntro,
} from "@/components/marketing/sell-journey-content";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";

/** Valuation routing body — heading lives on parent `LegalH2`. */
export function SellValuationSection() {
  return (
    <SellValuationIntro
      cta={
        <SellCtaLink
          href={sellIntakeHref()}
          source="sell_valuation_submit"
          className={MARKETING_PROSE_LINK}
        >
          {SELL_VALUATION_CTA_LABEL}
        </SellCtaLink>
      }
    />
  );
}
