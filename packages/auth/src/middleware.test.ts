import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdentityToken = vi.fn();
vi.mock("@auction/identity-contracts/verify", () => ({
  verifyIdentityToken,
}));

const { verifyBearerToken } = await import("./middleware.js");

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
