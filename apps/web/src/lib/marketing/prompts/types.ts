export const MARKETING_PROMPT_VARIANTS = ["selling", "signup"] as const;

export type MarketingPromptVariant = (typeof MARKETING_PROMPT_VARIANTS)[number];

export type MarketingPromptAuthState = "pending" | "guest" | "authenticated";

export type MarketingPromptTrigger = "sell-content" | "sell-query" | "engaged-browsing";

export type MarketingPromptDecision = {
  variant: MarketingPromptVariant;
  trigger: MarketingPromptTrigger;
};

export type MarketingPromptSuppressionReason = "dismissed" | "cta";

export type MarketingPromptSuppression = {
  reason: MarketingPromptSuppressionReason;
  recordedAt: number;
};

export type MarketingPromptSession = {
  activeDwellMs: number;
  eligiblePageViews: number;
  lastEligiblePath: string | null;
  shownVariant: MarketingPromptVariant | null;
  sellingIntentTrigger: Extract<MarketingPromptTrigger, "sell-content" | "sell-query"> | null;
};
