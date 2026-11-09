import { OIDC_ACR_BRONZE, OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { oidcSessionClaims } from "./oidc-session-claims.js";

const createdAt = new Date("2026-10-27T09:00:00.000Z");

describe("oidcSessionClaims", () => {
  it("describes a password sign-in as bronze with the session start as auth_time", () => {
    expect(
      oidcSessionClaims({
        id: "sid-1",
        createdAt,
        lastPasswordAuthAt: createdAt,
        mfaCompletedAt: null,
      }),
    ).toEqual({
      sid: "sid-1",
      auth_time: Math.floor(createdAt.getTime() / 1000),
      acr: OIDC_ACR_BRONZE,
      amr: ["pwd"],
    });
  });

  it("describes a two-step sign-in as silver", () => {
    expect(
      oidcSessionClaims({
        id: "sid-2",
        createdAt,
        lastPasswordAuthAt: createdAt,
        mfaCompletedAt: createdAt,
      }),
    ).toMatchObject({ acr: OIDC_ACR_SILVER, amr: ["pwd", "otp"] });
  });

  it("describes a passkey sign-in as silver and as a hardware key with user presence and several factors (RFC 8176), not as a password and a code", () => {
    expect(
      oidcSessionClaims({
        id: "sid-4",
        createdAt,
        lastPasswordAuthAt: null,
        mfaCompletedAt: createdAt,
        amr: ["passkey"],
      }),
    ).toEqual({
      sid: "sid-4",
      auth_time: Math.floor(createdAt.getTime() / 1000),
      acr: OIDC_ACR_SILVER,
      amr: ["hwk", "user", "mfa"],
    });
  });

  it("keeps describing a password-and-code session as such, whatever else the session recorded", () => {
    expect(
      oidcSessionClaims({
        id: "sid-5",
        createdAt,
        lastPasswordAuthAt: createdAt,
        mfaCompletedAt: createdAt,
        amr: ["password"],
      }),
    ).toMatchObject({ acr: OIDC_ACR_SILVER, amr: ["pwd", "otp"] });
  });

  it("leaves amr out when the session has no password or two-step proof", () => {
    const claims = oidcSessionClaims({
      id: "sid-3",
      createdAt,
      lastPasswordAuthAt: null,
      mfaCompletedAt: null,
    });
    expect(claims).not.toHaveProperty("amr");
    expect(claims.acr).toBe(OIDC_ACR_BRONZE);
  });
});
