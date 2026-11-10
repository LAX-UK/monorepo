import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBearerToken = vi.fn();
const bearerSigningKeyStatus = vi.fn();
vi.mock("@auction/auth/token-verifier", () => ({ verifyBearerToken, bearerSigningKeyStatus }));

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

describe("JwtAuthenticator.diagnoseRejection", () => {
  const authenticator = new JwtAuthenticator({
    issuer: "https://auth.lax.bid",
    jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
    audience: "lax-bid-api",
  });
  const headers = new Headers({ authorization: "Bearer api.jwt" });
  beforeEach(() => bearerSigningKeyStatus.mockReset());

  it("names only a retired signing key", async () => {
    bearerSigningKeyStatus.mockResolvedValueOnce("retired");
    await expect(authenticator.diagnoseRejection(headers)).resolves.toBe("token_key_unknown");
    for (const other of ["current", "malformed", null]) {
      bearerSigningKeyStatus.mockResolvedValueOnce(other);
      await expect(authenticator.diagnoseRejection(headers)).resolves.toBeNull();
    }
  });

  it("never throws", async () => {
    bearerSigningKeyStatus.mockRejectedValueOnce(new Error("jwks down"));
    await expect(authenticator.diagnoseRejection(headers)).resolves.toBeNull();
  });
});
