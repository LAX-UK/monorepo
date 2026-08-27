import { afterEach, describe, expect, it, vi } from "vitest";
import { areMarketingPromptsEnabled } from "./rollout.server";

describe("areMarketingPromptsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("honours an explicit true flag", () => {
    vi.stubEnv("MARKETING_PROMPTS_ENABLED", "true");
    expect(areMarketingPromptsEnabled()).toBe(true);
  });

  it("honours an explicit false flag", () => {
    vi.stubEnv("MARKETING_PROMPTS_ENABLED", "0");
    expect(areMarketingPromptsEnabled()).toBe(false);
  });
});
