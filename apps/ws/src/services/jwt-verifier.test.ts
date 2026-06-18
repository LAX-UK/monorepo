import { beforeEach, describe, expect, it, vi } from "vitest";

const jwtVerify = vi.fn();
const createRemoteJWKSet = vi.fn(() => "mock-jwks");

vi.mock("jose", () => ({
  createRemoteJWKSet,
  jwtVerify,
}));

const { verifySocketToken } = await import("./jwt-verifier.js");

describe("verifySocketToken", () => {
  beforeEach(() => {
    jwtVerify.mockReset();
  });

  it("returns null when token is missing", async () => {
    await expect(
      verifySocketToken({
        token: undefined,
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/jwks",
      }),
    ).resolves.toBeNull();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("returns user payload when token is valid", async () => {
    jwtVerify.mockResolvedValue({
      payload: { sub: "user-1", role: "staff", staff_role: "auctioneer" },
    });

    await expect(
      verifySocketToken({
        token: "valid.jwt",
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/jwks",
      }),
    ).resolves.toEqual({ id: "user-1", role: "staff", staff_role: "auctioneer" });
  });

  it("returns null when jwtVerify throws (expired or invalid token)", async () => {
    jwtVerify.mockRejectedValue(new Error("JWTExpired"));

    await expect(
      verifySocketToken({
        token: "expired.jwt",
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/jwks",
      }),
    ).resolves.toBeNull();
  });

  it("returns null when payload has no sub", async () => {
    jwtVerify.mockResolvedValue({ payload: { role: "client" } });

    await expect(
      verifySocketToken({
        token: "no-sub.jwt",
        issuer: "https://auth.test",
        jwksUrl: "https://auth.test/jwks",
      }),
    ).resolves.toBeNull();
  });
});
