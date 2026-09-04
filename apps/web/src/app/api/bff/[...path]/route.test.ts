import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class BidBffSessionRequiredError extends Error {}
  return {
    BidBffSessionRequiredError,
    fetchBidApi: vi.fn(),
    readBidSessionId: vi.fn(),
    resourceToken: vi.fn(),
  };
});

vi.mock("@/lib/bff/config.server", () => ({
  BID_API_AUDIENCE: "lax-bid-api",
  bffConfig: () => ({
    publicOrigin: "https://lax.bid",
    apiBaseUrl: "https://api.lax.bid",
  }),
}));
vi.mock("@/lib/bff/session-cookie.server", () => ({
  readBidSessionId: mocks.readBidSessionId,
}));
vi.mock("@/lib/bff/token-service.server", () => ({
  BidBffSessionRequiredError: mocks.BidBffSessionRequiredError,
  BidBffTokenService: class {
    resourceToken = mocks.resourceToken;
  },
}));
vi.mock("@/lib/data/http/bid-api.server", () => ({
  fetchBidApi: mocks.fetchBidApi,
}));

const { GET } = await import("./route");

function request() {
  return new NextRequest("https://lax.bid/api/bff/users/me?include=bids");
}

const context = { params: Promise.resolve({ path: ["users", "me"] }) };

describe("Bid BFF proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readBidSessionId.mockReturnValue("bff-session-1");
    mocks.resourceToken.mockResolvedValue({
      token: "resource-token",
      session: { kind: "authenticated" },
    });
    mocks.fetchBidApi.mockResolvedValue(Response.json({ ok: true }));
  });

  it("maps an unauthenticated token session to 401", async () => {
    mocks.resourceToken.mockRejectedValueOnce(new mocks.BidBffSessionRequiredError());

    const response = await GET(request(), context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "session_required" });
    expect(mocks.fetchBidApi).not.toHaveBeenCalled();
  });

  it.each(["identity endpoint", "Redis", "refresh lock"])(
    "maps %s failures to 503",
    async (dependency) => {
      mocks.resourceToken.mockRejectedValueOnce(new Error(`${dependency} unavailable`));

      const response = await GET(request(), context);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: "identity_unavailable" });
      expect(mocks.fetchBidApi).not.toHaveBeenCalled();
    },
  );

  it("maps Bid API network failures to 502", async () => {
    mocks.fetchBidApi.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await GET(request(), context);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "api_unavailable" });
  });

  it("preserves the upstream status, allowed headers, and streamed body", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("streamed"));
        controller.close();
      },
    });
    mocks.fetchBidApi.mockResolvedValueOnce(
      new Response(body, {
        status: 418,
        statusText: "Upstream status",
        headers: {
          "content-type": "text/plain",
          "x-request-id": "request-1",
          "set-cookie": "secret=value",
        },
      }),
    );

    const response = await GET(request(), context);

    expect(response.status).toBe(418);
    expect(response.statusText).toBe("Upstream status");
    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(response.headers.has("set-cookie")).toBe(false);
    await expect(response.text()).resolves.toBe("streamed");
  });

  it("force-exchanges once and retries when the Bid API rejects the cached token", async () => {
    mocks.resourceToken
      .mockResolvedValueOnce({ token: "cached-token", session: { kind: "authenticated" } })
      .mockResolvedValueOnce({ token: "fresh-token", session: { kind: "authenticated" } });
    mocks.fetchBidApi
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(mocks.resourceToken).toHaveBeenNthCalledWith(
      2,
      "bff-session-1",
      "lax-bid-api",
      "bid.read",
      true,
    );
    expect(mocks.fetchBidApi).toHaveBeenCalledTimes(2);
    expect((mocks.fetchBidApi.mock.calls[1]?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({}),
    );
    expect(
      ((mocks.fetchBidApi.mock.calls[1]?.[1] as RequestInit).headers as Headers).get(
        "authorization",
      ),
    ).toBe("Bearer fresh-token");
  });

  it.each([
    [new mocks.BidBffSessionRequiredError(), 401, "session_required"],
    [new Error("refresh lock unavailable"), 503, "identity_unavailable"],
  ])("maps force-exchange failure to %i", async (error, status, code) => {
    mocks.fetchBidApi.mockResolvedValueOnce(new Response(null, { status: 401 }));
    mocks.resourceToken
      .mockResolvedValueOnce({ token: "cached-token", session: { kind: "authenticated" } })
      .mockRejectedValueOnce(error);

    const response = await GET(request(), context);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: code });
    expect(mocks.fetchBidApi).toHaveBeenCalledOnce();
  });
});
