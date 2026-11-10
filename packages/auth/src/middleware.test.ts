import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdentityToken = vi.fn();
const diagnoseTokenRejection = vi.fn();
vi.mock("@auction/identity-contracts/verify", () => ({
  verifyIdentityToken,
  diagnoseTokenRejection,
}));

const { bearerRejectionCode, verifyBearerToken } = await import("./middleware.js");

describe("verifyBearerToken", () => {
  beforeEach(() => verifyIdentityToken.mockReset());

  it("extracts bearer credentials and delegates exact verification", async () => {
    verifyIdentityToken.mockResolvedValue({
      payload: { sub: "subject", aud: "lax-bid-api" },
      subject: "subject",
    });
    await expect(
      verifyBearerToken({
        authorization: "Bearer token",
        issuer: "https://auth.lax.bid",
        jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
        audience: "lax-bid-api",
      }),
    ).resolves.toMatchObject({ subject: "subject" });
    expect(verifyIdentityToken).toHaveBeenCalledWith({
      token: "token",
      issuer: "https://auth.lax.bid",
      jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
      audience: "lax-bid-api",
    });
  });

  it("rejects non-bearer authorization without verification", async () => {
    await expect(
      verifyBearerToken({
        authorization: "Basic token",
        issuer: "https://auth.lax.bid",
        jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
      }),
    ).resolves.toBeNull();
    expect(verifyIdentityToken).not.toHaveBeenCalled();
  });
});

describe("bearerRejectionCode", () => {
  const base = {
    issuer: "https://auth.lax.bid",
    jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
    audience: "lax-bid-api",
  };
  beforeEach(() => diagnoseTokenRejection.mockReset());

  it("hands the bearer token and the clock tolerance to the diagnosis", async () => {
    diagnoseTokenRejection.mockResolvedValue("token_expired");
    await expect(
      bearerRejectionCode({ ...base, authorization: "Bearer  token ", clockToleranceSeconds: 5 }),
    ).resolves.toBe("token_expired");
    expect(diagnoseTokenRejection).toHaveBeenCalledWith({
      ...base,
      token: "token",
      clockToleranceSeconds: 5,
    });
  });

  it("has nothing to say without a bearer token", async () => {
    await expect(
      bearerRejectionCode({ ...base, authorization: "Basic token" }),
    ).resolves.toBeNull();
    await expect(bearerRejectionCode({ ...base, authorization: undefined })).resolves.toBeNull();
    expect(diagnoseTokenRejection).not.toHaveBeenCalled();
  });
});
