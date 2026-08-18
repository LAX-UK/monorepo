import { beforeEach, describe, expect, it, vi } from "vitest";

const jwtVerify = vi.fn();
const createRemoteJWKSet = vi.fn(() => "mock-jwks");

vi.mock("jose", () => ({
  createRemoteJWKSet,
  jwtVerify,
}));

const { verifyIdentityToken } = await import("./verify-token.js");

describe("verifyIdentityToken", () => {
  beforeEach(() => {
    jwtVerify.mockReset();
    createRemoteJWKSet.mockClear();
  });

  it("returns null when token is empty", async () => {
    await expect(
      verifyIdentityToken({
        token: "   ",
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/.well-known/jwks.json",
      }),
    ).resolves.toBeNull();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("verifies via remote JWKS and returns the subject", async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: "user-1",
        iss: "https://auth.test",
        aud: "lax-bid-api",
      },
    });

    await expect(
      verifyIdentityToken({
        token: "valid.jwt",
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/.well-known/jwks.json",
      }),
    ).resolves.toEqual({
      subject: "user-1",
      payload: {
        sub: "user-1",
        iss: "https://auth.test",
        aud: "lax-bid-api",
      },
    });

    expect(createRemoteJWKSet).toHaveBeenCalledWith(
      new URL("https://auth.test/.well-known/jwks.json"),
      {
        cacheMaxAge: 10 * 60 * 1000,
        cooldownDuration: 30_000,
      },
    );
    expect(jwtVerify).toHaveBeenCalledWith("valid.jwt", "mock-jwks", {
      issuer: "https://auth.test",
      audience: "lax-bid-api",
      algorithms: ["RS256"],
    });
  });

  it("honors a custom audience", async () => {
    jwtVerify.mockResolvedValue({ payload: { sub: "user-1", aud: "lax-shop-web" } });

    await verifyIdentityToken({
      token: "valid.jwt",
      issuer: "https://auth.test",
      jwksUrl: "https://auth.test/.well-known/jwks.json",
      audience: "lax-shop-web",
    });

    expect(jwtVerify).toHaveBeenCalledWith("valid.jwt", "mock-jwks", {
      issuer: "https://auth.test",
      audience: "lax-shop-web",
      algorithms: ["RS256"],
    });
  });

  it("rejects multi-audience tokens even when one value matches", async () => {
    jwtVerify.mockResolvedValue({
      payload: { sub: "user-1", aud: ["lax-shop-web", "lax-shop-api"] },
    });
    await expect(
      verifyIdentityToken({
        token: "multi-audience.jwt",
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/.well-known/jwks.json",
        audience: "lax-shop-web",
      }),
    ).resolves.toBeNull();
  });

  it("returns null when jwtVerify throws (expired or invalid token)", async () => {
    jwtVerify.mockRejectedValue(new Error("JWTExpired"));

    await expect(
      verifyIdentityToken({
        token: "expired.jwt",
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/.well-known/jwks.json",
      }),
    ).resolves.toBeNull();
  });

  it("returns null when payload has no sub", async () => {
    jwtVerify.mockResolvedValue({ payload: { aud: "lax-bid-api" } });

    await expect(
      verifyIdentityToken({
        token: "no-sub.jwt",
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/.well-known/jwks.json",
      }),
    ).resolves.toBeNull();
  });
});
