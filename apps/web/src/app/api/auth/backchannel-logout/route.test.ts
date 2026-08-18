import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBackchannelLogoutToken = vi.fn();
const reserveReplay = vi.fn();
const invalidateBySidOrSubject = vi.fn();
const publish = vi.fn();

vi.mock("@auction/identity-contracts", () => ({
  BACKCHANNEL_LOGOUT_MAX_AGE_SECONDS: 300,
  SOCKET_REVOCATION_CHANNEL_V1: "identity:socket-revocation:v1",
  verifyBackchannelLogoutToken,
}));
vi.mock("@/lib/bff/config.server", () => ({
  bffConfig: () => ({
    internalIssuer: "http://auth:3003",
    issuer: "https://auth.lax.bid",
    clientId: "lax-bid-web",
  }),
}));
vi.mock("@/lib/bff/redis.server", () => ({
  ensureBffRedisConnected: async () => ({ set: reserveReplay, publish }),
  getBffRedis: () => ({}),
}));
vi.mock("@/lib/bff/session-store.server", () => ({
  BidBffSessionStore: class {
    invalidateBySidOrSubject = invalidateBySidOrSubject;
  },
}));

const { POST } = await import("./route");

function request() {
  return new Request("https://lax.bid/api/auth/backchannel-logout", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ logout_token: "signed.jwt" }),
  });
}

describe("Bid BFF back-channel logout receiver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reserveReplay.mockResolvedValue("OK");
    invalidateBySidOrSubject.mockResolvedValue(1);
    publish.mockResolvedValue(1);
    verifyBackchannelLogoutToken.mockResolvedValue({
      jti: "jti-1",
      sid: "sid-1",
      expiresAt: new Date(),
    });
  });

  it("pins issuer, audience, type and RS256 then invalidates the targeted sid", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(verifyBackchannelLogoutToken).toHaveBeenCalledWith({
      token: "signed.jwt",
      jwksUrl: "http://auth:3003/.well-known/jwks.json",
      issuer: "https://auth.lax.bid",
      audience: "lax-bid-web",
    });
    expect(invalidateBySidOrSubject).toHaveBeenCalledWith({ sid: "sid-1" });
    expect(publish).toHaveBeenCalledWith(
      "identity:socket-revocation:v1",
      JSON.stringify({ version: 1, reason: "backchannel_logout", sid: "sid-1" }),
    );
    expect(
      invalidateBySidOrSubject.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY);
  });

  it("rejects nonce and replay without invalidating twice", async () => {
    verifyBackchannelLogoutToken.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(400);
    expect(invalidateBySidOrSubject).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();

    reserveReplay.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(400);
    expect(invalidateBySidOrSubject).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not publish when local invalidation fails", async () => {
    invalidateBySidOrSubject.mockRejectedValueOnce(new Error("redis failure"));
    expect((await POST(request())).status).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });
});
