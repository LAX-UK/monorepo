import { describe, expect, it } from "vitest";
import {
  SIGNUP_PROMPT_MIN_ACTIVE_DWELL_MS,
  SIGNUP_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS,
  resolveMarketingPrompt,
  resolveSellingIntentTrigger,
} from "./policy";

const eligibleInput = {
  enabled: true,
  authState: "guest" as const,
  pathname: "/search",
  activeDwellMs: SIGNUP_PROMPT_MIN_ACTIVE_DWELL_MS,
  eligiblePageViews: SIGNUP_PROMPT_MIN_ELIGIBLE_PAGE_VIEWS,
  sellingIntentTrigger: null,
  sessionPromptShown: false,
  sellingSuppressed: false,
  signupSuppressed: false,
  competingDialogOpen: false,
};

describe("resolveMarketingPrompt", () => {
  it.each([
    ["disabled rollout", { enabled: false }],
    ["pending auth", { authState: "pending" as const }],
    ["signed-in visitor without selling intent", { authState: "authenticated" as const }],
    ["first eligible page", { eligiblePageViews: 1 }],
    ["insufficient active dwell", { activeDwellMs: 44_999 }],
    ["excluded route", { pathname: "/lot/example/lot-1" }],
    ["session cap reached", { sessionPromptShown: true }],
    ["dismissal active", { signupSuppressed: true }],
    ["another dialog open", { competingDialogOpen: true }],
  ])("returns no prompt for %s", (_, overrides) => {
    expect(resolveMarketingPrompt({ ...eligibleInput, ...overrides })).toBeNull();
  });

  it("shows signup only after meaningful guest browsing", () => {
    expect(resolveMarketingPrompt(eligibleInput)).toEqual({
      variant: "signup",
      trigger: "engaged-browsing",
    });
  });

  it("prioritizes demonstrated selling intent for signed-in visitors and guests", () => {
    for (const authState of ["guest", "authenticated"] as const) {
      expect(
        resolveMarketingPrompt({
          ...eligibleInput,
          authState,
          activeDwellMs: 15_000,
          eligiblePageViews: 2,
          sellingIntentTrigger: "sell-content",
        }),
      ).toEqual({ variant: "selling", trigger: "sell-content" });
    }
  });

  it("falls back to signup when selling is suppressed and signup remains eligible", () => {
    expect(
      resolveMarketingPrompt({
        ...eligibleInput,
        sellingIntentTrigger: "sell-query",
        sellingSuppressed: true,
      }),
    ).toEqual({ variant: "signup", trigger: "engaged-browsing" });
  });
});

describe("resolveSellingIntentTrigger", () => {
  it.each([
    ["/sell", "", "sell-content"],
    ["/sell/watches", "", "sell-content"],
    ["/search", "?intent=sell", "sell-query"],
    ["/", "?utm_campaign=summer_consignment", "sell-query"],
    ["/search", "?intent=buy", null],
  ])("resolves %s%s", (pathname, search, expected) => {
    expect(resolveSellingIntentTrigger({ pathname, search })).toBe(expected);
  });
});
