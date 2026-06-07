import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";

/** Valuation routing body — heading lives on parent `LegalH2`. */
export function SellValuationSection() {
  return (
    <p>
      If you are ready to sell,{" "}
      <SellCtaLink
        href={sellIntakeHref()}
        source="sell_valuation_submit"
        className={MARKETING_PROSE_LINK}
      >
        start your submission
      </SellCtaLink>{" "}
      with the key details and images. Our specialists review every submission and respond within 24
      hours.
    </p>
  );
}
