import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { UnsecuredJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import type { IdentityJwtSignInput } from "../infrastructure/identity-jwt-signer.ports.js";
import { hashRefreshToken } from "./refresh-token-family.ports.js";
import {
  type IdTokenContinuityRecord,
  type IdTokenContinuityStore,
  type LiveIdentitySession,
  RefreshedIdTokenService,
} from "./refreshed-id-token.service.js";

const ISSUER = "https://auth.example.test";
const signedInAt = new Date("2026-10-27T08:00:00.000Z");

function idToken(claims: Record<string, unknown>): string {
  return new UnsecuredJWT(claims).encode();
}

function memoryContinuity() {
  const records = new Map<string, IdTokenContinuityRecord>();
  const store: IdTokenContinuityStore = {
    put: vi.fn(async (hash: string, record: IdTokenContinuityRecord) => {
      records.set(hash, record);
    }),
    take: vi.fn(async (hash: string) => {
      const record = records.get(hash) ?? null;
      records.delete(hash);
      return record;
    }),
  };
  return { store, records };
}

function setup(overrides: { session?: LiveIdentitySession | null; active?: boolean } = {}) {
  const continuity = memoryContinuity();
  const signed: IdentityJwtSignInput[] = [];
  const session: LiveIdentitySession | null =
    overrides.session === undefined
      ? {
          id: "sid-1",
          subjectId: "user-1",
          createdAt: signedInAt,
          lastPasswordAuthAt: signedInAt,
          mfaCompletedAt: signedInAt,
        }
      : overrides.session;
  const findLiveIdentitySession = vi.fn(async () => session);
  const service = new RefreshedIdTokenService({
    continuity: continuity.store,
    findLiveIdentitySession,
    isSubjectActive: vi.fn(async () => overrides.active ?? true),
    accessClaims: vi.fn(async () => ({ lax_staff_platforms: ["bid"] })),
    signer: {
      sign: vi.fn(async (input: IdentityJwtSignInput) => {
        signed.push(input);
        return { token: `signed-${signed.length}`, kid: "key-1" };
      }),
    },
    idTokenTtlSec: 900,
    continuityTtlSec: 2_592_000,
  });
  return { service, continuity, signed, findLiveIdentitySession };
}

const originalClaims = {
  iss: ISSUER,
  aud: "lax-shop-admin",
  sub: "user-1",
  iat: 1_000,
  exp: 1_900,
  nonce: "nonce-1",
  sid: "sid-1",
  auth_time: 999,
  acr: "old-acr",
  email: "staff@lax.test",
  email_verified: true,
  name: "Staff Person",
  lax_staff_platforms: [],
};

describe("RefreshedIdTokenService", () => {
  it("renews the ID token for the same subject, client and sign-in", async () => {
    const { service, signed, continuity } = setup();
    await service.rememberIssued({ refreshToken: "refresh-1", idToken: idToken(originalClaims) });

    const token = await service.renew({
      previousRefreshToken: "refresh-1",
      nextRefreshToken: "refresh-2",
    });

    expect(token).toBe("signed-1");
    expect(signed[0]).toMatchObject({
      typ: "JWT",
      issuer: ISSUER,
      audience: "lax-shop-admin",
      subject: "user-1",
      expirationTime: "900s",
    });
    expect(signed[0]?.claims).toEqual({
      email: "staff@lax.test",
      email_verified: true,
      name: "Staff Person",
      lax_staff_platforms: ["bid"],
      sid: "sid-1",
      auth_time: Math.floor(signedInAt.getTime() / 1000),
      acr: OIDC_ACR_SILVER,
      amr: ["pwd", "otp"],
    });
    expect(continuity.records.has(hashRefreshToken("refresh-1"))).toBe(false);
    expect(continuity.records.has(hashRefreshToken("refresh-2"))).toBe(true);
  });

  it("keeps renewing across rotations", async () => {
    const { service } = setup();
    await service.rememberIssued({ refreshToken: "refresh-1", idToken: idToken(originalClaims) });
    await service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-2" });

    await expect(
      service.renew({ previousRefreshToken: "refresh-2", nextRefreshToken: "refresh-3" }),
    ).resolves.toBe("signed-2");
  });

  it("does not renew twice from the same refresh token", async () => {
    const { service } = setup();
    await service.rememberIssued({ refreshToken: "refresh-1", idToken: idToken(originalClaims) });
    await service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-2" });

    await expect(
      service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-x" }),
    ).resolves.toBeNull();
  });

  it("returns null for a refresh token it never saw issued", async () => {
    const { service, signed } = setup();
    await expect(
      service.renew({ previousRefreshToken: "unknown", nextRefreshToken: "refresh-2" }),
    ).resolves.toBeNull();
    expect(signed).toHaveLength(0);
  });

  it("stops renewing once the sign-in has ended", async () => {
    const { service, signed, continuity } = setup({ session: null });
    await service.rememberIssued({ refreshToken: "refresh-1", idToken: idToken(originalClaims) });

    await expect(
      service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-2" }),
    ).resolves.toBeNull();
    expect(signed).toHaveLength(0);
    expect(continuity.records.size).toBe(0);
  });

  it("refuses a session that belongs to someone else", async () => {
    const { service } = setup({
      session: {
        id: "sid-1",
        subjectId: "user-2",
        createdAt: signedInAt,
        lastPasswordAuthAt: signedInAt,
        mfaCompletedAt: null,
      },
    });
    await service.rememberIssued({ refreshToken: "refresh-1", idToken: idToken(originalClaims) });

    await expect(
      service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-2" }),
    ).resolves.toBeNull();
  });

  it("refuses a disabled or merged identity", async () => {
    const { service } = setup({ active: false });
    await service.rememberIssued({ refreshToken: "refresh-1", idToken: idToken(originalClaims) });

    await expect(
      service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-2" }),
    ).resolves.toBeNull();
  });

  it("does not remember a token without a session or with several audiences", async () => {
    const { service, continuity } = setup();
    const { sid: _sid, ...withoutSid } = originalClaims;
    await service.rememberIssued({ refreshToken: "a", idToken: idToken(withoutSid) });
    await service.rememberIssued({
      refreshToken: "b",
      idToken: idToken({ ...originalClaims, aud: ["one", "two"] }),
    });

    expect(continuity.records.size).toBe(0);
  });
});
