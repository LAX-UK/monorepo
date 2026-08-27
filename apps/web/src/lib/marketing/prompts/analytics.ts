import { trackMarketingPrompt } from "@/lib/analytics/events";
import { trackSellCtaClick } from "@/lib/analytics/sell-funnel";
import type { MarketingPromptDecision } from "./types";

export type MarketingPromptAnalytics = {
  onImpression(decision: MarketingPromptDecision, path: string): void;
  onDismiss(decision: MarketingPromptDecision, path: string): void;
  onCta(decision: MarketingPromptDecision, path: string): void;
};

export const defaultMarketingPromptAnalytics: MarketingPromptAnalytics = {
  onImpression(decision, path) {
    trackMarketingPrompt({
      action: "impression",
      variant: decision.variant,
      trigger: decision.trigger,
      path,
    });
  },
  onDismiss(decision, path) {
    trackMarketingPrompt({
      action: "dismissal",
      variant: decision.variant,
      trigger: decision.trigger,
      path,
    });
  },
  onCta(decision, path) {
    trackMarketingPrompt({
      action: "cta",
      variant: decision.variant,
      trigger: decision.trigger,
      path,
    });
    if (decision.variant === "selling") {
      trackSellCtaClick("contextual_marketing_prompt");
    }
  },
};
