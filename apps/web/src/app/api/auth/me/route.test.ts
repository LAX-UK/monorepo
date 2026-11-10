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

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bff/config.server", () => ({
  BID_API_AUDIENCE: "lax-bid-api",
  bffConfig: () => ({ apiBaseUrl: "https://api.lax.bid" }),
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
vi.mock("@/lib/data/http/bid-api.server", () => ({ fetchBidApi: mocks.fetchBidApi }));

const { GET } = await import("./route");

const request = () => new NextRequest("https://lax.bid/api/auth/me");
const replaceable = (code: string) =>
  Response.json({ error: "Unauthorized", code }, { status: 401 });
const bearerOf = (call: number) =>
  (mocks.fetchBidApi.mock.calls[call]?.[1] as { headers: Record<string, string> }).headers
    .authorization;

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readBidSessionId.mockReturnValue("bff-session-1");
    mocks.resourceToken.mockReset();
    mocks.resourceToken.mockResolvedValue({ token: "cached", session: {} });
    mocks.fetchBidApi.mockReset();
  });

  it("reports the signed-in user", async () => {
    mocks.fetchBidApi.mockResolvedValue(Response.json({ data: { id: "user-1" } }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      data: { id: "user-1" },
    });
  });

  it.each(["token_key_unknown", "token_expired"])(
    "keeps the person signed in after %s: one new token, one resend",
    async (code) => {
      mocks.resourceToken
        .mockResolvedValueOnce({ token: "cached", session: {} })
        .mockResolvedValueOnce({ token: "fresh", session: {} });
      mocks.fetchBidApi
        .mockResolvedValueOnce(replaceable(code))
        .mockResolvedValueOnce(Response.json({ data: { id: "user-1" } }));

      const response = await GET(request());

      expect(response.status).toBe(200);
      expect(mocks.resourceToken).toHaveBeenNthCalledWith(
        2,
        "bff-session-1",
        "lax-bid-api",
        "bid.read",
        { replacing: "cached" },
      );
      expect(bearerOf(0)).toBe("Bearer cached");
      expect(bearerOf(1)).toBe("Bearer fresh");
    },
  );

  it("does not retry any other refusal", async () => {
    mocks.fetchBidApi.mockResolvedValue(replaceable("session_required"));
    const response = await GET(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ authenticated: false });
    expect(mocks.fetchBidApi).toHaveBeenCalledOnce();
    expect(mocks.resourceToken).toHaveBeenCalledOnce();
  });

  it("reports signed out when the session is gone", async () => {
    mocks.resourceToken.mockRejectedValue(new mocks.BidBffSessionRequiredError());
    const response = await GET(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ authenticated: false });
    expect(mocks.fetchBidApi).not.toHaveBeenCalled();
  });

  it("reports signed out with no session cookie", async () => {
    mocks.readBidSessionId.mockReturnValue(undefined);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.resourceToken).not.toHaveBeenCalled();
  });
});
