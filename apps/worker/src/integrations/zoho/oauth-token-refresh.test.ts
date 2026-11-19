import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import {
  getZohoCrmAccessToken,
  resetZohoTokenCacheForTests,
  setZohoTokenRefreshObserver,
} from "./oauth-token-refresh.js";

const ENV = {
  ZOHO_CLIENT_ID: "id",
  ZOHO_CLIENT_SECRET: "secret",
  ZOHO_REFRESH_TOKEN: "refresh",
  ZOHO_ACCOUNTS_HOST: "https://accounts.zoho.eu",
} as WorkerEnv;

function deferredFetch() {
  let release: (res: Response) => void = () => {};
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  return { fetchMock, release: (res: Response) => release(res) };
}

describe("getZohoCrmAccessToken single-flight", () => {
  afterEach(() => {
    setZohoTokenRefreshObserver(null);
    resetZohoTokenCacheForTests();
    vi.unstubAllGlobals();
  });

  it("makes one refresh for concurrent cache misses and gives them all its token", async () => {
    const { fetchMock, release } = deferredFetch();
    vi.stubGlobal("fetch", fetchMock);
    const refreshed = vi.fn();
    setZohoTokenRefreshObserver({ refreshed, failed: vi.fn() });

    const callers = Array.from({ length: 5 }, () => getZohoCrmAccessToken(ENV));
    await Promise.resolve();
    release(new Response(JSON.stringify({ access_token: "shared", expires_in: 3600 })));

    expect(await Promise.all(callers)).toEqual(Array(5).fill("shared"));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(refreshed).toHaveBeenCalledOnce();
  });

  it("fails every waiting caller once, reports once, and lets the next call refresh again", async () => {
    const { fetchMock, release } = deferredFetch();
    vi.stubGlobal("fetch", fetchMock);
    const failed = vi.fn();
    setZohoTokenRefreshObserver({ refreshed: vi.fn(), failed });

    const callers = Array.from({ length: 3 }, () => getZohoCrmAccessToken(ENV));
    await Promise.resolve();
    release(new Response('{"error":"invalid_client"}', { status: 400 }));

    const results = await Promise.allSettled(callers);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledOnce();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ access_token: "next", expires_in: 3600 }))),
    );
    expect(await getZohoCrmAccessToken(ENV)).toBe("next");
  });

  it("gives up on a hung refresh after a timeout, so callers are not stalled", async () => {
    const fetchMock = vi.fn(
      (_url: URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation timed out.", "TimeoutError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const failed = vi.fn();
    setZohoTokenRefreshObserver({ refreshed: vi.fn(), failed });

    const pending = getZohoCrmAccessToken(ENV);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // Fire the timeout's abort directly rather than waiting 15 s.
    (init?.signal as AbortSignal).dispatchEvent(new Event("abort"));
    await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    expect(failed).toHaveBeenCalledWith("zoho_token_refresh_unreachable");
  });
});
