import { describe, expect, it } from "vitest";
import {
  CROSS_PLATFORM_ID_TOKEN_CLAIMS,
  DEFAULT_JWT_AUDIENCE,
  MINIMAL_ACCESS_TOKEN_CLAIMS,
  crossPlatformIdTokenPayloadSchemaV1,
  minimalAccessTokenPayloadSchemaV1,
} from "./claims.js";

describe("cross-platform token claim contracts", () => {
  it("freezes the external id_token claim allowlist", () => {
    expect(CROSS_PLATFORM_ID_TOKEN_CLAIMS).toEqual([
      "sub",
      "iss",
      "aud",
      "iat",
      "exp",
      "sid",
      "auth_time",
      "acr",
      "amr",
      "email",
      "email_verified",
      "name",
    ]);
    expect(CROSS_PLATFORM_ID_TOKEN_CLAIMS).not.toContain("role");
    expect(CROSS_PLATFORM_ID_TOKEN_CLAIMS).not.toContain("staff_role");
  });

  it("freezes the minimal access-token claim allowlist", () => {
    expect(MINIMAL_ACCESS_TOKEN_CLAIMS).toEqual(["sub", "iss", "aud", "iat", "exp", "sid"]);
  });

  it("defaults first-party audience to lax-bid-api", () => {
    expect(DEFAULT_JWT_AUDIENCE).toBe("lax-bid-api");
  });

  it("accepts cross-platform id_token payloads without product authorization claims", () => {
    expect(
      crossPlatformIdTokenPayloadSchemaV1.parse({
        sub: "user-1",
        iss: "https://auth.lax.bid",
        aud: "lax-shop-web",
        iat: 1_730_409_600,
        exp: 1_730_410_500,
        sid: "session-1",
        auth_time: 1_730_409_590,
        acr: "urn:mace:incommon:iap:silver",
        amr: ["pwd", "otp"],
        email: "alice@example.com",
        email_verified: true,
        name: "Alice Example",
      }),
    ).toMatchObject({ sub: "user-1", email: "alice@example.com" });
  });

  it("rejects cross-platform id_token payloads missing required claims", () => {
    expect(() =>
      crossPlatformIdTokenPayloadSchemaV1.parse({
        iss: "https://auth.lax.bid",
        aud: "lax-bid-api",
        iat: 1,
        exp: 2,
      }),
    ).toThrow();
  });

  it("rejects millisecond auth_time and unsupported assurance claims", () => {
    const base = {
      sub: "user-1",
      iss: "https://auth.lax.bid",
      aud: "lax-bid-web",
      iat: 1_730_409_600,
      exp: 1_730_410_500,
      sid: "session-1",
    };
    expect(() =>
      crossPlatformIdTokenPayloadSchemaV1.parse({
        ...base,
        auth_time: 1_730_409_600_000,
        acr: "urn:mace:incommon:iap:gold",
      }),
    ).toThrow();
  });

  it("accepts minimal access-token payloads", () => {
    expect(
      minimalAccessTokenPayloadSchemaV1.parse({
        sub: "user-1",
        iss: "https://auth.lax.bid",
        aud: ["lax-bid-api", "lax-shop-web"],
        iat: 1_730_409_600,
        exp: 1_730_410_500,
      }),
    ).toMatchObject({ sub: "user-1", aud: ["lax-bid-api", "lax-shop-web"] });
  });
});
