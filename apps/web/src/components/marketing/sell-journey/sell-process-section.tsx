import { MarketingProcessSteps } from "@/components/marketing/marketing-process-steps";
import { SELL_MARKETING_JOURNEY_STEPS } from "@/components/marketing/sell-journey-content";
import { SELL_PAGE_CONSIGNMENT_WORKS } from "@/lib/marketing/sell-flow-copy";

/** How-it-works body — heading lives on parent `LegalH2`. */
export function SellProcessSection() {
  return (
    <div className="space-y-6">
      <p>{SELL_PAGE_CONSIGNMENT_WORKS}</p>
      <p>
        From first enquiry to catalogue listing, the seller journey below takes about three minutes
        to submit.
      </p>
      <MarketingProcessSteps steps={SELL_MARKETING_JOURNEY_STEPS} />
    </div>
  );
}
