import { afterEach, describe, expect, it, vi } from "vitest";
import { areMarketingPromptsEnabled } from "./rollout.server";

describe("marketing prompt rollout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults on outside production and off in production", () => {
    vi.stubEnv("MARKETING_PROMPTS_ENABLED", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(areMarketingPromptsEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(areMarketingPromptsEnabled()).toBe(false);
  });

  it("honors an explicit production switch", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MARKETING_PROMPTS_ENABLED", "true");
    expect(areMarketingPromptsEnabled()).toBe(true);

    vi.stubEnv("MARKETING_PROMPTS_ENABLED", "false");
    expect(areMarketingPromptsEnabled()).toBe(false);
  });
});
