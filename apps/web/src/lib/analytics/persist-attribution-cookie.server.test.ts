import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAttributionCookieServer,
  persistAttributionCookieServer,
} from "./persist-attribution-cookie.server";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server attribution cookie client", () => {
  it("persists a validated snapshot through the same-origin route", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchFn);
    const snapshot = {
      version: 1 as const,
      lastTouch: {
        capturedAt: "2026-01-01T00:00:00.000Z",
        landingPath: "/campaign",
        utmSource: "google",
      },
    };
    await persistAttributionCookieServer(snapshot);
    expect(fetchFn).toHaveBeenCalledWith("/api/attribution", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
  });

  it("clears through DELETE and rejects failed responses", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchFn);
    await clearAttributionCookieServer();
    expect(fetchFn).toHaveBeenNthCalledWith(1, "/api/attribution", {
      method: "DELETE",
      credentials: "same-origin",
    });
    await expect(clearAttributionCookieServer()).rejects.toThrow("attribution_cookie_http_500");
  });
});
