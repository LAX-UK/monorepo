import type { SubjectStatusReader } from "@auction/auth";
import type { RegisteredOidcClientId } from "@auction/identity-contracts";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it, vi } from "vitest";
import type { ManagedOauthToken, OauthTokenStore } from "./oauth-token-management.ports.js";
import {
  OauthTokenManagementService,
  canClientIntrospectAudience,
  isTokenOwnedByClient,
} from "./oauth-token-management.service.js";

const NOW = new Date("2026-08-19T00:00:00.000Z");

function tokenRow(overrides: Partial<ManagedOauthToken> = {}): ManagedOauthToken {
  return {
    id: "token-1",
    clientId: "lax-shop-web",
    userId: "subject-1",
    scopes: "openid shop.read",
    accessToken: "access-1",
    refreshToken: "refresh-1",
    accessTokenExpiresAt: new Date(NOW.getTime() + 60_000),
    refreshTokenExpiresAt: new Date(NOW.getTime() + 120_000),
    refreshFamilyId: "family-1",
    refreshConsumedAt: null,
    createdAt: new Date(NOW.getTime() - 30_000),
    ...overrides,
  };
}

function createService(options: {
  row?: ManagedOauthToken | null;
  unavailableSubject?: boolean;
  jwks?: { id: string; publicKey: string; alg?: string }[];
}) {
  const store: OauthTokenStore = {
    findByClientAndToken: vi.fn(async () => options.row ?? null),
    deleteToken: vi.fn(async () => undefined),
    deleteRefreshFamily: vi.fn(async () => undefined),
  };
  const subjectStatus: SubjectStatusReader = {
    isDisabledOrMerged: vi.fn(async () => options.unavailableSubject ?? false),
  };
  const service = new OauthTokenManagementService(
    store,
    subjectStatus,
    "https://auth.lax.bid",
    { getJwks: vi.fn(async () => options.jwks ?? []) },
    () => NOW,
  );
  return { service, store, subjectStatus };
}

describe("OAuth token requester policy", () => {
  it("prevents cross-client opaque token disclosure or revocation", () => {
    expect(isTokenOwnedByClient("lax-shop-web", "lax-shop-web")).toBe(true);
    expect(isTokenOwnedByClient("lax-shop-web", "lax-bid-web")).toBe(false);
  });

  it("only introspects token-exchange JWT audiences allowed to the requester", () => {
    expect(canClientIntrospectAudience("lax-shop-web", "lax-shop-api")).toBe(true);
    expect(canClientIntrospectAudience("lax-shop-web", "lax-bid-api")).toBe(false);
    expect(canClientIntrospectAudience("lax-bid-web", "lax-shop-api")).toBe(false);
  });
});

describe("OAuth token management service", () => {
  it("denies cross-client token revocation without deleting anything", async () => {
    const { service, store } = createService({ row: tokenRow() });

    await expect(
      service.revoke({ requesterClientId: "lax-bid-web", token: "access-1" }),
    ).resolves.toEqual({ subjectId: null, refreshRevoked: false });
    expect(store.deleteToken).not.toHaveBeenCalled();
    expect(store.deleteRefreshFamily).not.toHaveBeenCalled();
  });

  it("deletes one access token but revokes the whole refresh family", async () => {
    const access = createService({ row: tokenRow() });
    await expect(
      access.service.revoke({
        requesterClientId: "lax-shop-web",
        token: "access-1",
        tokenTypeHint: "access_token",
      }),
    ).resolves.toEqual({ subjectId: "subject-1", refreshRevoked: false });
    expect(access.store.deleteToken).toHaveBeenCalledWith("token-1");

    const refresh = createService({ row: tokenRow() });
    await expect(
      refresh.service.revoke({
        requesterClientId: "lax-shop-web",
        token: "refresh-1",
        tokenTypeHint: "refresh_token",
      }),
    ).resolves.toEqual({ subjectId: "subject-1", refreshRevoked: true });
    expect(refresh.store.deleteRefreshFamily).toHaveBeenCalledWith("family-1");
  });

  it("introspects active opaque tokens and rejects expired or consumed tokens", async () => {
    const active = createService({ row: tokenRow() });
    await expect(
      active.service.introspect({
        requesterClientId: "lax-shop-web",
        token: "access-1",
        tokenTypeHint: "access_token",
      }),
    ).resolves.toMatchObject({
      active: true,
      client_id: "lax-shop-web",
      scope: "openid shop.read",
      sub: "subject-1",
    });

    const expired = createService({
      row: tokenRow({ accessTokenExpiresAt: new Date(NOW.getTime() - 1) }),
    });
    await expect(
      expired.service.introspect({
        requesterClientId: "lax-shop-web",
        token: "access-1",
        tokenTypeHint: "access_token",
      }),
    ).resolves.toEqual({ active: false });

    const consumed = createService({
      row: tokenRow({ refreshConsumedAt: new Date(NOW.getTime() - 1) }),
    });
    await expect(
      consumed.service.introspect({
        requesterClientId: "lax-shop-web",
        token: "refresh-1",
        tokenTypeHint: "refresh_token",
      }),
    ).resolves.toEqual({ active: false });
  });

  it("rejects opaque tokens for missing, disabled, or merged subjects", async () => {
    const { service } = createService({ row: tokenRow(), unavailableSubject: true });
    await expect(
      service.introspect({ requesterClientId: "lax-shop-web", token: "access-1" }),
    ).resolves.toEqual({ active: false });
  });

  it("introspects an allowed JWT audience and denies unavailable subjects", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    const jwtNow = Math.floor(Date.now() / 1_000);
    const token = await new SignJWT({ scope: "shop.read" })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setIssuer("https://auth.lax.bid")
      .setAudience("lax-shop-api")
      .setSubject("subject-1")
      .setIssuedAt(jwtNow)
      .setExpirationTime(jwtNow + 60)
      .sign(privateKey);
    const jwks = [{ id: "key-1", publicKey: JSON.stringify(publicJwk), alg: "RS256" }];

    const active = createService({ jwks });
    await expect(
      active.service.introspect({ requesterClientId: "lax-shop-web", token }),
    ).resolves.toMatchObject({
      active: true,
      aud: "lax-shop-api",
      scope: "shop.read",
      sub: "subject-1",
    });

    const unavailable = createService({ jwks, unavailableSubject: true });
    await expect(
      unavailable.service.introspect({ requesterClientId: "lax-shop-web", token }),
    ).resolves.toEqual({ active: false });
  });

  it.each([
    ["lax-shop-web", "lax-bid-api"],
    ["lax-bid-web", "lax-shop-api"],
  ] as const)("denies JWT audience %s -> %s", async (requesterClientId, audience) => {
    expect(canClientIntrospectAudience(requesterClientId as RegisteredOidcClientId, audience)).toBe(
      false,
    );
  });
});
