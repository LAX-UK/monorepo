import { beforeEach, describe, expect, it, vi } from "vitest";

const jwtVerify = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "jwks"),
  jwtVerify,
}));

const { BACKCHANNEL_LOGOUT_EVENT, validateBackchannelLogoutClaims, verifyBackchannelLogoutToken } =
  await import("./backchannel-logout.js");

const claims = {
  iss: "https://auth.example.test",
  aud: "lax-bid-web",
  iat: 1_700_000_000,
  jti: "logout-1",
  sid: "session-1",
  events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
};

describe("OIDC back-channel logout tokens", () => {
  beforeEach(() => jwtVerify.mockReset());

  it("validates the exact event, scalar audience, freshness, and target", () => {
    const expected = {
      issuer: claims.iss,
      audience: claims.aud,
      now: claims.iat + 100,
    };
    expect(validateBackchannelLogoutClaims(claims, expected)).toMatchObject({
      jti: "logout-1",
      sid: "session-1",
    });
    expect(
      validateBackchannelLogoutClaims(
        { ...claims, events: { [BACKCHANNEL_LOGOUT_EVENT]: { extra: true } } },
        expected,
      ),
    ).toBeNull();
    expect(validateBackchannelLogoutClaims({ ...claims, aud: [claims.aud] }, expected)).toBeNull();
    expect(validateBackchannelLogoutClaims({ ...claims, nonce: "forbidden" }, expected)).toBeNull();
    expect(validateBackchannelLogoutClaims({ ...claims, sid: undefined }, expected)).toBeNull();
  });

  it("pins RS256, logout+jwt, issuer, audience, and maximum age", async () => {
    jwtVerify.mockResolvedValue({ payload: claims });
    await expect(
      verifyBackchannelLogoutToken({
        token: "signed.jwt",
        jwksUrl: "https://auth.example.test/.well-known/jwks.json",
        issuer: claims.iss,
        audience: claims.aud,
        now: claims.iat + 100,
      }),
    ).resolves.toMatchObject({ jti: "logout-1" });
    expect(jwtVerify).toHaveBeenCalledWith("signed.jwt", "jwks", {
      issuer: claims.iss,
      audience: claims.aud,
      algorithms: ["RS256"],
      typ: "logout+jwt",
      maxTokenAge: "300s",
      currentDate: new Date((claims.iat + 100) * 1_000),
    });
  });
});
