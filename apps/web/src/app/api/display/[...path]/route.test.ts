import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchBidApi = vi.fn();

vi.mock("@/lib/bff/config.server", () => ({
  bffConfig: () => ({
    publicOrigin: "https://lax.bid",
    apiBaseUrl: "http://127.0.0.1:3001",
  }),
}));
vi.mock("@/lib/data/http/bid-api.server", () => ({ fetchBidApi }));

const { GET, POST } = await import("./route");

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(`https://lax.bid/api/display/${path}`, init);
}

describe("display API forwarding route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchBidApi.mockResolvedValue(
      Response.json({ ok: true }, { headers: { "x-request-id": "request-1" } }),
    );
  });

  it("forwards snapshot requests to the fixed API origin with the display bearer unchanged", async () => {
    const saleId = "5cf0cb93-4ed4-4d9f-bbc3-e53fe77be63e";
    const response = await GET(
      request(`${saleId}/snapshot`, {
        headers: {
          authorization: "Bearer display-secret",
          cookie: "bid_bff_session=must-not-forward",
          "x-legal-entity-id": "must-not-forward",
        },
      }),
      { params: Promise.resolve({ path: [saleId, "snapshot"] }) },
    );

    expect(response.status).toBe(200);
    expect(fetchBidApi).toHaveBeenCalledOnce();
    const [target, init] = fetchBidApi.mock.calls[0] as [URL, RequestInit];
    expect(target.href).toBe(`http://127.0.0.1:3001/display/${saleId}/snapshot`);
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer display-secret");
    expect(headers.get("origin")).toBe("https://lax.bid");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-legal-entity-id")).toBe(false);
  });

  it("forwards anonymous pairing through the dedicated route without session authorization", async () => {
    const response = await POST(
      request("pair/poll", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://lax.bid",
          "sec-fetch-site": "same-origin",
          cookie: "bid_bff_session=must-not-forward",
          authorization: "Bearer must-not-forward",
        },
        body: JSON.stringify({ deviceCode: "ABCD-EFGH" }),
      }),
      { params: Promise.resolve({ path: ["pair", "poll"] }) },
    );

    expect(response.status).toBe(200);
    const [target, init] = fetchBidApi.mock.calls[0] as [URL, RequestInit];
    expect(target.href).toBe("http://127.0.0.1:3001/display/pair/poll");
    const headers = new Headers(init.headers);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"deviceCode":"ABCD-EFGH"}');
  });

  it("enforces same-origin CSRF checks for display writes", async () => {
    const response = await POST(
      request("heartbeat", {
        method: "POST",
        headers: {
          authorization: "Bearer display-secret",
          origin: "https://attacker.example",
        },
      }),
      { params: Promise.resolve({ path: ["heartbeat"] }) },
    );

    expect(response.status).toBe(403);
    expect(fetchBidApi).not.toHaveBeenCalled();
  });

  it("rejects unlisted display paths, methods, and missing display tokens", async () => {
    const saleId = "5cf0cb93-4ed4-4d9f-bbc3-e53fe77be63e";
    expect(
      (
        await GET(request("pair/start"), {
          params: Promise.resolve({ path: ["pair", "start"] }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await GET(request(`${saleId}/snapshot`), {
          params: Promise.resolve({ path: [saleId, "snapshot"] }),
        })
      ).status,
    ).toBe(401);
    expect(fetchBidApi).not.toHaveBeenCalled();
  });
});
