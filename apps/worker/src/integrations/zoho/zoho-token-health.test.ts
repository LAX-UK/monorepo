import type { Logger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import {
  getZohoCrmAccessToken,
  resetZohoTokenCacheForTests,
  setZohoTokenRefreshObserver,
} from "./oauth-token-refresh.js";
import { ZohoTokenHealthMonitor } from "./zoho-token-health.js";

const NOW = new Date("2026-11-11T12:00:00.000Z");
const ENV = {
  ZOHO_CLIENT_ID: "id",
  ZOHO_CLIENT_SECRET: "secret",
  ZOHO_REFRESH_TOKEN: "refresh",
  ZOHO_ACCOUNTS_HOST: "https://accounts.zoho.eu",
} as WorkerEnv;

function setup(streaks: number[]) {
  const log = { warn: vi.fn(), error: vi.fn() };
  const failures = [...streaks];
  const store = {
    recordTokenRefreshed: vi.fn(async () => {}),
    recordTokenRefreshFailed: vi.fn(async () => ({ failureStreak: failures.shift() ?? 1 })),
  };
  const monitor = new ZohoTokenHealthMonitor({
    store,
    log: log as unknown as Logger,
    now: () => NOW,
  });
  return { log, store, monitor };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Zoho token health monitor", () => {
  it("records a good refresh with when it expires", async () => {
    const { store, monitor } = setup([]);
    const expiresAt = new Date(NOW.getTime() + 3_600_000);
    monitor.refreshed(expiresAt);
    await settle();
    expect(store.recordTokenRefreshed).toHaveBeenCalledWith(expiresAt, NOW);
  });

  it("warns on a first failure and raises the alert on the second in a row", async () => {
    const { log, store, monitor } = setup([1, 2, 3]);
    monitor.failed("zoho_token_refresh_failed_400");
    await settle();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledOnce();

    monitor.failed("zoho_token_refresh_failed_400");
    await settle();
    expect(log.error).toHaveBeenCalledOnce();
    expect(log.error.mock.calls[0]?.[0]).toMatchObject({
      alert: "zoho_token_refresh_failing",
      failureStreak: 2,
      code: "zoho_token_refresh_failed_400",
    });

    monitor.failed("zoho_token_refresh_failed_400");
    await settle();
    expect(log.error).toHaveBeenCalledOnce();
    expect(store.recordTokenRefreshFailed).toHaveBeenCalledTimes(3);
  });

  it("never lets a failure to record reach the caller", async () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const store = {
      recordTokenRefreshed: vi.fn(async () => {
        throw new Error("db down");
      }),
      recordTokenRefreshFailed: vi.fn(async () => {
        throw new Error("db down");
      }),
    };
    const monitor = new ZohoTokenHealthMonitor({ store, log: log as unknown as Logger });
    expect(() => monitor.refreshed(NOW)).not.toThrow();
    expect(() => monitor.failed("x")).not.toThrow();
    await settle();
    expect(log.warn).toHaveBeenCalledTimes(2);
  });
});

describe("token refresh reports to the observer", () => {
  afterEach(() => {
    setZohoTokenRefreshObserver(null);
    resetZohoTokenCacheForTests();
    vi.unstubAllGlobals();
  });

  it("reports a refresh that worked, with its expiry", async () => {
    const refreshed = vi.fn();
    setZohoTokenRefreshObserver({ refreshed, failed: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))),
    );
    expect(await getZohoCrmAccessToken(ENV)).toBe("t");
    expect(refreshed).toHaveBeenCalledOnce();
    expect((refreshed.mock.calls[0]?.[0] as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("reports a refresh Zoho refused by its status, without Zoho's text", async () => {
    const failed = vi.fn();
    setZohoTokenRefreshObserver({ refreshed: vi.fn(), failed });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":"invalid_code"}', { status: 400 })),
    );
    await expect(getZohoCrmAccessToken(ENV)).rejects.toThrow();
    expect(failed).toHaveBeenCalledWith("zoho_token_refresh_failed_400");
  });

  it("reports a refresh that never reached Zoho", async () => {
    const failed = vi.fn();
    setZohoTokenRefreshObserver({ refreshed: vi.fn(), failed });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(getZohoCrmAccessToken(ENV)).rejects.toThrow("fetch failed");
    expect(failed).toHaveBeenCalledWith("zoho_token_refresh_unreachable");
  });

  it("keeps serving a cached token without reporting", async () => {
    const refreshed = vi.fn();
    setZohoTokenRefreshObserver({ refreshed, failed: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))),
    );
    await getZohoCrmAccessToken(ENV);
    await getZohoCrmAccessToken(ENV);
    expect(refreshed).toHaveBeenCalledOnce();
  });
});
