import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommerceBffClient } from "./create-commerce-bff-client.js";

function clientWith(requestHeaders?: () => Promise<{ get(name: string): string | null }>) {
  return createCommerceBffClient({
    resolveUrl: (path) => `http://identity.test${path}`,
    cookiePort: { readAll: async () => [], read: async () => undefined },
    commerceCookieNames: new Set(),
    timeoutMs: 1000,
    ...(requestHeaders ? { requestHeaders } : {}),
  });
}

describe("createCommerceBffClient client address headers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forwards the proxy chain headers of the browser request", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const incoming = new Headers({
      "x-forwarded-for": "203.0.113.9, 10.0.0.2",
      "x-real-ip": "10.0.0.2",
    });
    await clientWith(async () => incoming).request("/commerce/me/general-enquiries");
    const sent = new Headers(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers,
    );
    expect(sent.get("x-forwarded-for")).toBe("203.0.113.9, 10.0.0.2");
    expect(sent.get("x-real-ip")).toBe("10.0.0.2");
  });

  it("sends no address headers when none were provided", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await clientWith(async () => new Headers()).request("/commerce/csrf");
    const sent = new Headers(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers,
    );
    expect(sent.has("x-forwarded-for")).toBe(false);
  });
});
