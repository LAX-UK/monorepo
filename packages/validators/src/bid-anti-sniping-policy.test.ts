import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANTI_SNIPING_EXTENSION_MS,
  DEFAULT_ANTI_SNIPING_WINDOW_MS,
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

  it("formats full anti-sniping rule sentence", () => {
    expect(formatAntiSnipingRuleSentence()).toBe(
      "A bid in the final 2 minutes extends that lot's closing time by 30 seconds to reduce last-second sniping.",
    );
  });
});
