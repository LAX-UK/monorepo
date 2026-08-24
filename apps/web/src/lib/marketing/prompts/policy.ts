import type {
  MarketingPromptAuthState,
  MarketingPromptDecision,
  MarketingPromptTrigger,
} from "./types";

export const SELLING_PROMPT_MIN_ACTIVE_DWELL_MS = 15_000;
export const SELLING_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS = 1;
export const SIGNUP_PROMPT_MIN_ACTIVE_DWELL_MS = 45_000;
export const SIGNUP_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS = 3;

const ELIGIBLE_EXACT_PATHS = new Set(["/", "/archive", "/artists", "/buy", "/sales", "/search"]);
const ELIGIBLE_PATH_PREFIXES = ["/artist/", "/artists/"];

export function isMarketingPromptRoute(pathname: string): boolean {
  return (
    ELIGIBLE_EXACT_PATHS.has(pathname) ||
    ELIGIBLE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function resolveSellingIntentTrigger({
  pathname,
  search,
}: {
  pathname: string;
  search: string;
}): Extract<MarketingPromptTrigger, "sell-content" | "sell-query"> | null {
  if (pathname === "/sell" || pathname.startsWith("/sell/")) return "sell-content";

  const params = new URLSearchParams(search);
  const intent = params.get("intent")?.toLowerCase();
  if (intent === "sell" || intent === "selling" || intent === "valuation") return "sell-query";

  const campaign = (params.get("utm_campaign")?.toLowerCase() ?? "").replace(/[_-]+/g, " ");
  return /\b(sell|selling|consign|consignment|valuation)\b/.test(campaign) ? "sell-query" : null;
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

  if (
    sellingIntentTrigger &&
    !sellingSuppressed &&
    activeDwellMs >= SELLING_PROMPT_MIN_ACTIVE_DWELL_MS &&
    eligiblePageViews >= SELLING_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS
  ) {
    return { variant: "selling", trigger: sellingIntentTrigger };
  }

  if (
    authState === "guest" &&
    !signupSuppressed &&
    activeDwellMs >= SIGNUP_PROMPT_MIN_ACTIVE_DWELL_MS &&
    eligiblePageViews >= SIGNUP_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS
  ) {
    return { variant: "signup", trigger: "engaged-browsing" };
  }

  return null;
}
