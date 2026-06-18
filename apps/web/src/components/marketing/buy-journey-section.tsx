import { BUY_JOURNEY_STEPS } from "@/components/marketing/buy-journey-content";
import { MarketingProcessSteps } from "@/components/marketing/marketing-process-steps";

/** Numbered buy journey for `/buy`. */
export function BuyJourneySection() {
  return <MarketingProcessSteps steps={BUY_JOURNEY_STEPS} />;
}
