import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBearerToken = vi.fn();
const bearerRejectionCode = vi.fn();
vi.mock("@auction/auth/token-verifier", () => ({ verifyBearerToken, bearerRejectionCode }));

const { JwtAuthenticator } = await import("./jwt-authenticator.js");

describe("JwtAuthenticator audience isolation", () => {
  beforeEach(() => verifyBearerToken.mockReset());

  it("verifies only the configured Bid API audience by default", async () => {
    verifyBearerToken.mockResolvedValue(null);
    const authenticator = new JwtAuthenticator({
      issuer: "https://auth.lax.bid",
      jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
      audience: "lax-bid-api",
    });
    await expect(
      authenticator.getSessionUser(new Headers({ authorization: "Bearer ws.jwt" })),
    ).resolves.toBeNull();
    expect(verifyBearerToken).toHaveBeenCalledTimes(1);
    expect(verifyBearerToken).toHaveBeenCalledWith(
      expect.objectContaining({ audience: "lax-bid-api" }),
    );
  });

  it("propagates the signed OIDC sid for step-up correlation", async () => {
    verifyBearerToken.mockResolvedValueOnce({
      subject: "user-1",
      payload: { sid: "identity-session-1" },
    });
    const authenticator = new JwtAuthenticator({
      issuer: "https://auth.lax.bid",
      jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
      audience: "lax-bid-api",
    });
    await expect(
      authenticator.getSessionUser(new Headers({ authorization: "Bearer api.jwt" })),
    ).resolves.toMatchObject({ id: "user-1", identitySessionId: "identity-session-1" });
    expect(verifyBearerToken).toHaveBeenCalledTimes(1);
  });
});

describe("JwtAuthenticator clock tolerance", () => {
  it("allows 5 seconds of clock skew when verifying, on both audiences", async () => {
    verifyBearerToken.mockReset();
    verifyBearerToken.mockResolvedValue(null);
    const authenticator = new JwtAuthenticator({
      issuer: "https://auth.lax.bid",
      jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
      audience: "lax-bid-api",
      allowLegacyLaxApiAudience: true,
    });
    await authenticator.getSessionUser(new Headers({ authorization: "Bearer api.jwt" }));
    expect(verifyBearerToken).toHaveBeenCalledTimes(2);
    for (const [options] of verifyBearerToken.mock.calls) {
      expect(options).toMatchObject({ clockToleranceSeconds: 5 });
    }
  });
});

describe("JwtAuthenticator.diagnoseRejection", () => {
  const authenticator = new JwtAuthenticator({
    issuer: "https://auth.lax.bid",
    jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
    audience: "lax-bid-api",
  });
  const headers = new Headers({ authorization: "Bearer api.jwt" });
  beforeEach(() => bearerRejectionCode.mockReset());

  it("passes on a replaceable rejection, with the same issuer, audience and tolerance", async () => {
    for (const code of ["token_key_unknown", "token_expired"]) {
      bearerRejectionCode.mockResolvedValueOnce(code);
      await expect(authenticator.diagnoseRejection(headers)).resolves.toBe(code);
    }
    expect(bearerRejectionCode).toHaveBeenCalledWith({
      authorization: "Bearer api.jwt",
      jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
      issuer: "https://auth.lax.bid",
      audience: "lax-bid-api",
      clockToleranceSeconds: 5,
    });
  });

  it("names nothing for any other failure", async () => {
    bearerRejectionCode.mockResolvedValueOnce(null);
    await expect(authenticator.diagnoseRejection(headers)).resolves.toBeNull();
  });

  it("never throws", async () => {
    bearerRejectionCode.mockRejectedValueOnce(new Error("jwks down"));
    await expect(authenticator.diagnoseRejection(headers)).resolves.toBeNull();
  });
});
