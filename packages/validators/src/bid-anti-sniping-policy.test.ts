import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANTI_SNIPING_EXTENSION_MS,
  DEFAULT_ANTI_SNIPING_WINDOW_MS,
  formatAntiSnipingClosingRuleParagraph,
  formatAntiSnipingExtensionLabel,
  formatAntiSnipingRuleSentence,
  formatAntiSnipingWindowLabel,
} from "./bid-anti-sniping-policy.js";

describe("bid-anti-sniping-policy", () => {
  it("exports default timings matching API bid policy", () => {
    expect(DEFAULT_ANTI_SNIPING_WINDOW_MS).toBe(120_000);
    expect(DEFAULT_ANTI_SNIPING_EXTENSION_MS).toBe(30_000);
  });

  it("formats window and extension labels", () => {
    expect(formatAntiSnipingWindowLabel()).toBe("2 minutes");
    expect(formatAntiSnipingExtensionLabel()).toBe("30 seconds");
  });

  it("formats short inline anti-sniping rule", () => {
    expect(formatAntiSnipingRuleSentence()).toBe(
      "If a bid is placed in the final 2 minutes of a lot's scheduled closing time, that lot's closing time is extended by 30 seconds.",
    );
  });

  it("formats FAQ paragraph with per-lot scope", () => {
    expect(formatAntiSnipingClosingRuleParagraph()).toContain(
      "If a bid is placed in the final 2 minutes of a lot's scheduled closing time",
    );
    expect(formatAntiSnipingClosingRuleParagraph()).toContain("that lot only");
    expect(formatAntiSnipingClosingRuleParagraph()).not.toMatch(/snip/i);
  });
});
