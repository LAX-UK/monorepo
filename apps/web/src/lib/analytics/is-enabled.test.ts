import { afterEach, describe, expect, it, vi } from "vitest";

describe("isAnalyticsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false when NODE_ENV is not production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-ABC");
    const { isAnalyticsEnabled } = await import("@/lib/analytics/is-enabled");
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("is false in production without GTM id", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    const { isAnalyticsEnabled } = await import("@/lib/analytics/is-enabled");
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("is true in production with a non-empty GTM id", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-W6K4N67Z");
    const { isAnalyticsEnabled } = await import("@/lib/analytics/is-enabled");
    expect(isAnalyticsEnabled()).toBe(true);
  });
});
