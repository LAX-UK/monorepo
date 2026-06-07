import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { sellContactHref, sellIntakeHref } from "@/lib/marketing/sell-intake";

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
        start a submission
      </SellCtaLink>{" "}
      with the key details and images. If you need to speak with a specialist first,{" "}
      <SellCtaLink
        href={sellContactHref()}
        source="sell_valuation_contact"
        className={MARKETING_PROSE_LINK}
      >
        contact our team
      </SellCtaLink>{" "}
      and choose the selling topic so we can route your enquiry.
    </p>
  );
}
