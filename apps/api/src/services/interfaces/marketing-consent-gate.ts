import type { MarketingEvent } from "@auction/types";

export interface IMarketingConsentGate {
  isAllowed(event: MarketingEvent): boolean;
}
