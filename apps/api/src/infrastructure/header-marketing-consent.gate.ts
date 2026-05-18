import type { MarketingEvent } from "@auction/types";
import type { IMarketingConsentGate } from "../services/interfaces/marketing-consent-gate.js";

const LEGITIMATE_INTEREST_EVENTS = new Set<MarketingEvent["name"]>([
  "Purchase",
  "CompleteRegistration",
]);

/** Evaluates consent carried on the event payload (set by routes from cookies/headers). */
export class EventMarketingConsentGate implements IMarketingConsentGate {
  isAllowed(event: MarketingEvent): boolean {
    if (event.consent.basis === "legitimate_interest") {
      return LEGITIMATE_INTEREST_EVENTS.has(event.name);
    }
    return event.consent.marketing;
  }
}

export function marketingConsentFromHeaders(
  marketingHeader: string | undefined,
  analyticsHeader: string | undefined,
): MarketingEvent["consent"] {
  const marketing = marketingHeader === "1";
  const analytics = analyticsHeader === "1";
  return { marketing, analytics, basis: "consent" };
}
