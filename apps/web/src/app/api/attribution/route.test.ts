import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

vi.mock("@/lib/analytics/is-marketing-attribution-enabled", () => ({
  isMarketingAttributionEnabled: () => true,
}));

import { POST } from "./route";

const snapshot = {
  version: 1,
  lastTouch: {
    capturedAt: "2026-01-01T00:00:00.000Z",
    landingPath: "/campaign",
    utmSource: "google",
  },
};

function request(body: unknown): Request {
  return new Request("https://lax.bid/api/attribution", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://lax.bid",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  cookieGet.mockReset();
  cookieGet.mockReturnValue({
    value: encodeURIComponent(
      JSON.stringify({
        v: 1,
        ts: "2026-01-01T00:00:00.000Z",
        necessary: true,
        analytics: true,
        marketing: true,
      }),
    ),
  });
});

describe("attribution cookie route", () => {
  it("sets a once-encoded, readable attribution cookie", async () => {
    const response = await POST(request({ snapshot }));
    expect(response.status).toBe(204);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("_lax_attr=%7B");
    expect(setCookie).not.toContain("%257B");

    const value = setCookie.match(/_lax_attr=([^;]+)/)?.[1];
    expect(JSON.parse(decodeURIComponent(value ?? ""))).toEqual(snapshot);
  });

  it("rejects persistence without marketing consent", async () => {
    cookieGet.mockReturnValue(undefined);
    expect((await POST(request({ snapshot }))).status).toBe(403);
  });

  it("rejects cross-origin writes", async () => {
    const crossOrigin = new Request("https://lax.bid/api/attribution", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ snapshot }),
    });
    expect((await POST(crossOrigin)).status).toBe(403);
  });
});
