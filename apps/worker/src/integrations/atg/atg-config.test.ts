import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../../env.js";
import { loadAtgRuntimeConfig } from "./atg-config.js";

const ATG_ENV = {
  ATG_SYNC_ENABLED: "true",
  ATG_API_USERNAME: "api@lax.bid",
  ATG_API_PASSWORD: "secret",
  ATG_PLATFORM_CODE: "LAX",
  ATG_INCREMENT_SET_ID: "8d3c1f2e-4b5a-4c6d-8e7f-9a0b1c2d3e4f",
  ATG_DEFAULT_CATEGORY: "Fine Art",
  S3_PUBLIC_BASE_URL: "https://media.example",
};

function stubEnv(values: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("APP_ENV", "development");
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("loadAtgRuntimeConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off by default", () => {
    stubEnv({ ATG_SYNC_ENABLED: "" });
    expect(loadAtgRuntimeConfig(loadWorkerEnv())).toBeNull();
  });

  it("builds production-safe defaults when enabled", () => {
    stubEnv(ATG_ENV);
    const config = loadAtgRuntimeConfig(loadWorkerEnv());

    expect(config?.adapter).toEqual({
      baseUrl: "https://api.globalauctionplatform.com",
      username: "api@lax.bid",
      password: "secret",
    });
    expect(config?.sync).not.toHaveProperty("auctionType");
    expect(config?.sync).toMatchObject({
      artistPlacement: "description",
      currency: "GBP",
      countryCode: "UK",
      timezone: "Europe/London",
      mediaBaseUrl: "https://media.example",
    });
    expect(config?.pollIntervalMs).toBe(120_000);
  });

  it("fails fast when enabled without credentials", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ...ATG_ENV, ATG_API_PASSWORD: "" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });

  it("rejects poll intervals beyond the readiness heartbeat window", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ...ATG_ENV, ATG_POLL_INTERVAL_MS: "600000" });
    expect(() => loadWorkerEnv()).toThrow();
  });

  it("rejects unmapped timezones at startup", () => {
    stubEnv({ ...ATG_ENV, ATG_TIMEZONE: "Mars/Olympus" });
    expect(() => loadAtgRuntimeConfig(loadWorkerEnv())).toThrow(/No Windows timezone mapping/);
  });
});
