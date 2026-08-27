import { isMarketingPromptRoute } from "./route-eligibility";
import type {
  MarketingPromptAuthState,
  MarketingPromptDecision,
  MarketingPromptTrigger,
  MarketingPromptVariant,
} from "./types";

export const SELLING_PROMPT_MIN_ACTIVE_DWELL_MS = 15_000;
export const SELLING_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS = 1;
export const SIGNUP_PROMPT_MIN_ACTIVE_DWELL_MS = 45_000;
export const SIGNUP_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS = 3;

type PromptRuleInput = {
  authState: MarketingPromptAuthState;
  sellingIntentTrigger: Extract<MarketingPromptTrigger, "sell-content" | "sell-query"> | null;
};

type PromptRule = {
  variant: MarketingPromptVariant;
  minActiveDwellMs: number;
  minEligiblePageViews: number;
  qualifies: (input: PromptRuleInput) => MarketingPromptTrigger | null;
};

const sellingRule: PromptRule = {
  variant: "selling",
  minActiveDwellMs: SELLING_PROMPT_MIN_ACTIVE_DWELL_MS,
  minEligiblePageViews: SELLING_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS,
  qualifies: (input) => input.sellingIntentTrigger,
};

const signupRule: PromptRule = {
  variant: "signup",
  minActiveDwellMs: SIGNUP_PROMPT_MIN_ACTIVE_DWELL_MS,
  minEligiblePageViews: SIGNUP_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS,
  qualifies: (input) => (input.authState === "guest" ? "engaged-browsing" : null),
};

const PROMPT_RULES: readonly PromptRule[] = [sellingRule, signupRule];

function isVariantSuppressed(
  variant: MarketingPromptVariant,
  sellingSuppressed: boolean,
  signupSuppressed: boolean,
): boolean {
  return variant === "selling" ? sellingSuppressed : signupSuppressed;
}

export function resolveMarketingPrompt({
  enabled,
  authState,
  pathname,
  activeDwellMs,
  eligiblePageViews,
  sellingIntentTrigger,
  sessionPromptShown,
  sellingSuppressed,
  signupSuppressed,
  competingDialogOpen,
}: {
  enabled: boolean;
  authState: MarketingPromptAuthState;
  pathname: string;
  activeDwellMs: number;
  eligiblePageViews: number;
  sellingIntentTrigger: Extract<MarketingPromptTrigger, "sell-content" | "sell-query"> | null;
  sessionPromptShown: boolean;
  sellingSuppressed: boolean;
  signupSuppressed: boolean;
  competingDialogOpen: boolean;
}): MarketingPromptDecision | null {
  if (
    !enabled ||
    authState === "pending" ||
    sessionPromptShown ||
    competingDialogOpen ||
    !isMarketingPromptRoute(pathname)
  ) {
    return null;
  }

  for (const rule of PROMPT_RULES) {
    if (isVariantSuppressed(rule.variant, sellingSuppressed, signupSuppressed)) continue;
    if (activeDwellMs < rule.minActiveDwellMs) continue;
    if (eligiblePageViews < rule.minEligiblePageViews) continue;
    const trigger = rule.qualifies({ authState, sellingIntentTrigger });
    if (trigger) return { variant: rule.variant, trigger };
  }

  return null;
}
