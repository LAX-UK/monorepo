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
const markBidSilentQuiet = vi.fn();
const markBidSilentGuestResult = vi.fn();
vi.mock("@/lib/auth/silent-sign-in/cookies.server", () => ({
  markBidSilentQuiet,
  markBidSilentGuestResult,
  clearBidSilentSuppressed: vi.fn(),
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
    expect(response.headers.get("location")).toBe(
      "https://lax.bid/auth/post-login?next=%2Fdashboard&auth_fresh=1",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(validateCallbackState).toHaveBeenCalledWith("expected-state", "expected-state");
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith({
      code: "authorization-code",
      codeVerifier: "pkce-verifier",
      nonce: "expected-nonce",
      requireRecentAuthentication: false,
      maxAgeSeconds: 300,
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

  it("invalidates the replaced session after a successful re-login", async () => {
    readSession.mockImplementation(async (id: string) => {
      if (id === "prior-session") {
        return { kind: "authenticated", subject: "user-1" };
      }
      return {
        kind: "pending",
        state: "expected-state",
        codeVerifier: "pkce-verifier",
        nonce: "expected-nonce",
        nextPath: "/dashboard",
        replacesSessionId: "prior-session",
      };
    });

    await GET(request("state=expected-state&code=authorization-code"));

    expect(invalidateSession).toHaveBeenCalledWith("prior-session");
  });

  it("invalidates a pending session when callback binding fails", async () => {
    validateCallbackState.mockReturnValue(false);

    const response = await GET(request("state=attacker-state&code=authorization-code"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://lax.bid/login?error=oidc_callback&next=%2Fdashboard",
    );
    expect(invalidateSession).toHaveBeenCalledWith("pending-session");
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(clearBidSessionCookie).toHaveBeenCalledWith(response);
  });

  it("restores the prior session when reauth subject mismatches", async () => {
    readBidSessionId.mockReturnValue("pending-session");
    readSession.mockImplementation(async (id: string) => {
      if (id === "prior-session") {
        return { kind: "authenticated", subject: "user-original" };
      }
      if (id === "pending-session") {
        return {
          kind: "pending",
          state: "expected-state",
          codeVerifier: "pkce-verifier",
          nonce: "expected-nonce",
          nextPath: "/dashboard",
          entryIntent: "reauth",
          replacesSessionId: "prior-session",
        };
      }
      return null;
    });
    exchangeAuthorizationCode.mockResolvedValue({
      subject: "user-attacker",
      sid: "identity-session-2",
    });

    const response = await GET(request("state=expected-state&code=authorization-code"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://lax.bid/login?error=reauth_subject_mismatch&next=%2Fdashboard&restored=1&intent=reauth",
    );
    expect(setBidSessionCookie).toHaveBeenCalledWith(response, "prior-session", "authenticated");
    expect(rotateAuthenticated).not.toHaveBeenCalled();
  });

  it("redirects silent probe login_required to nextPath as guest with quiet cookie", async () => {
    readSession.mockResolvedValue({
      kind: "pending",
      state: "expected-state",
      codeVerifier: "pkce-verifier",
      nonce: "expected-nonce",
      nextPath: "/catalog",
      entryIntent: "silent",
    });

    const response = await GET(request("error=login_required&state=expected-state"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://lax.bid/catalog");
    expect(invalidateSession).toHaveBeenCalledWith("pending-session");
    expect(clearBidSessionCookie).toHaveBeenCalledWith(response);
    expect(markBidSilentQuiet).toHaveBeenCalledWith(response);
    expect(markBidSilentGuestResult).toHaveBeenCalledWith(response);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("invalidates the pending session when code exchange or rotation fails", async () => {
    exchangeAuthorizationCode.mockRejectedValue(new Error("invalid verifier"));

    const response = await GET(request("state=expected-state&code=authorization-code"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://lax.bid/login?error=oidc_exchange&next=%2Fdashboard",
    );
    expect(invalidateSession).toHaveBeenCalledWith("pending-session");
    expect(clearBidSessionCookie).toHaveBeenCalledWith(response);
  });
});
