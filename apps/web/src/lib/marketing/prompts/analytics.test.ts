import { afterEach, describe, expect, it, vi } from "vitest";

const trackMarketingPrompt = vi.fn();
const trackSellCtaClick = vi.fn();

vi.mock("@/lib/analytics/events", () => ({
  trackMarketingPrompt: (...args: unknown[]) => trackMarketingPrompt(...args),
}));

vi.mock("@/lib/analytics/sell-funnel", () => ({
  trackSellCtaClick: (...args: unknown[]) => trackSellCtaClick(...args),
}));

describe("defaultMarketingPromptAnalytics", () => {
  afterEach(() => {
    trackMarketingPrompt.mockReset();
    trackSellCtaClick.mockReset();
  });

  it("maps CTA for selling to the sell funnel event", async () => {
    const { defaultMarketingPromptAnalytics } = await import("./analytics");
    defaultMarketingPromptAnalytics.onCta(
      { variant: "selling", trigger: "sell-content" },
      "/search",
    );
    expect(trackMarketingPrompt).toHaveBeenCalledWith({
      action: "cta",
      variant: "selling",
      trigger: "sell-content",
      path: "/search",
    });
    expect(trackSellCtaClick).toHaveBeenCalledWith("contextual_marketing_prompt");
  });
});
