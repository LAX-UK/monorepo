import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeAuthorizationCode = vi.fn();
const validateCallbackState = vi.fn();
const readBidSessionId = vi.fn();
const setBidSessionCookie = vi.fn();
const clearBidSessionCookie = vi.fn();
const readSession = vi.fn();
const invalidateSession = vi.fn();
const rotateAuthenticated = vi.fn();

vi.mock("@/lib/bff/oidc.server", () => ({
  exchangeAuthorizationCode,
  validateCallbackState,
}));
vi.mock("@/lib/bff/public-origin-url.server", () => ({
  resolvePublicOriginUrl: (path: string) => new URL(path, "https://lax.bid"),
}));
vi.mock("@/lib/bff/redis.server", () => ({
  getBffRedis: () => ({}),
}));
vi.mock("@/lib/bff/session-cookie.server", () => ({
  readBidSessionId,
  setBidSessionCookie,
  clearBidSessionCookie,
}));
vi.mock("@/lib/bff/session-store.server", () => ({
  BidBffSessionStore: class {
    read = readSession;
    invalidate = invalidateSession;
    rotateAuthenticated = rotateAuthenticated;
  },
}));

const { GET } = await import("./route");

function request(query: string) {
  return new NextRequest(`https://lax.bid/api/auth/callback/lax-bid-web?${query}`);
}

describe("Bid BFF OIDC callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readBidSessionId.mockReturnValue("pending-session");
    readSession.mockResolvedValue({
      kind: "pending",
      state: "expected-state",
      codeVerifier: "pkce-verifier",
      nonce: "expected-nonce",
      nextPath: "/dashboard",
    });
    validateCallbackState.mockReturnValue(true);
    exchangeAuthorizationCode.mockResolvedValue({
      subject: "user-1",
      sid: "identity-session-1",
    });
    rotateAuthenticated.mockResolvedValue("authenticated-session");
  });

  it("binds state, nonce and PKCE before rotating the browser session", async () => {
    const response = await GET(request("state=expected-state&code=authorization-code"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://lax.bid/dashboard");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(validateCallbackState).toHaveBeenCalledWith("expected-state", "expected-state");
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith({
      code: "authorization-code",
      codeVerifier: "pkce-verifier",
      nonce: "expected-nonce",
    });
    expect(rotateAuthenticated).toHaveBeenCalledWith("pending-session", {
      subject: "user-1",
      sid: "identity-session-1",
    });
    expect(setBidSessionCookie).toHaveBeenCalledWith(
      response,
      "authenticated-session",
      "authenticated",
    );
    expect(invalidateSession).not.toHaveBeenCalled();
  });

  it("invalidates a pending session when callback binding fails", async () => {
    validateCallbackState.mockReturnValue(false);

    const response = await GET(request("state=attacker-state&code=authorization-code"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://lax.bid/login?error=oidc_callback");
    expect(invalidateSession).toHaveBeenCalledWith("pending-session");
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(clearBidSessionCookie).toHaveBeenCalledWith(response);
  });

  it("invalidates the pending session when code exchange or rotation fails", async () => {
    exchangeAuthorizationCode.mockRejectedValue(new Error("invalid verifier"));

    const response = await GET(request("state=expected-state&code=authorization-code"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://lax.bid/login?error=oidc_exchange");
    expect(invalidateSession).toHaveBeenCalledWith("pending-session");
    expect(clearBidSessionCookie).toHaveBeenCalledWith(response);
  });
});
