import { createIdentityDb } from "@auction/identity-db";
import { oauthAccessToken, oauthApplication, user } from "@auction/identity-db/schema";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleOauthTokenStore } from "./drizzle-oauth-token-store.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("drizzle OAuth token store", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const store = db ? new DrizzleOauthTokenStore(db) : undefined;
  const subjectId = "90000000-0000-4000-8000-000000000098";
  const tokenIds = ["oauth-token-store-a", "oauth-token-store-b"];
  const now = new Date();

  beforeAll(async () => {
    if (!db) return;
    await db
      .insert(user)
      .values({
        id: subjectId,
        name: "OAuth Token Store Test",
        email: "oauth-token-store-test@lax.bid",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db
      .insert(oauthApplication)
      .values({
        id: "oauth-token-store-app",
        name: "OAuth Token Store Test",
        clientId: "lax-shop-web",
        redirectUrls: "http://localhost:3010/auth/callback",
        type: "web",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db.delete(oauthAccessToken).where(inArray(oauthAccessToken.id, tokenIds));
    await db.insert(oauthAccessToken).values(
      tokenIds.map((id, index) => ({
        id,
        accessToken: `oauth-token-store-access-${index}`,
        refreshToken: `oauth-token-store-refresh-${index}`,
        accessTokenExpiresAt: new Date(now.getTime() + 60_000),
        refreshTokenExpiresAt: new Date(now.getTime() + 120_000),
        refreshFamilyId: "oauth-token-store-family",
        clientId: "lax-shop-web",
        userId: subjectId,
        scopes: "openid shop.read",
        createdAt: now,
        updatedAt: now,
      })),
    );
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(oauthAccessToken).where(inArray(oauthAccessToken.id, tokenIds));
    await db.delete(user).where(inArray(user.id, [subjectId]));
  });

  it("finds a token only through the requested token class", async () => {
    if (!store) return;
    await expect(
      store.findByClientAndToken({
        requesterClientId: "lax-shop-web",
        accessTokenCandidates: ["oauth-token-store-access-0"],
        refreshTokenCandidates: [],
      }),
    ).resolves.toMatchObject({
      id: "oauth-token-store-a",
      clientId: "lax-shop-web",
      userId: subjectId,
      refreshFamilyId: "oauth-token-store-family",
    });
    await expect(
      store.findByClientAndToken({
        requesterClientId: "lax-shop-web",
        accessTokenCandidates: ["oauth-token-store-refresh-0"],
        refreshTokenCandidates: [],
      }),
    ).resolves.toBeNull();
  });

  it("deletes every token in a refresh family", async () => {
    if (!store) return;
    await store.deleteRefreshFamily("oauth-token-store-family");
    await expect(
      store.findByClientAndToken({
        requesterClientId: "lax-shop-web",
        accessTokenCandidates: ["oauth-token-store-access-1"],
        refreshTokenCandidates: [],
      }),
    ).resolves.toBeNull();
  });
});
