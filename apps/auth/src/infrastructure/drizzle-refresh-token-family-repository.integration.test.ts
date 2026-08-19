import { createIdentityDb } from "@auction/identity-db";
import { oauthAccessToken, oauthApplication, session, user } from "@auction/identity-db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashRefreshToken } from "../services/refresh-token-family.ports.js";
import { DrizzleRefreshTokenFamilyRepository } from "./drizzle-refresh-token-family-repository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("drizzle refresh token family repository", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const logout = { revokeSubject: vi.fn(async () => 0) };
  const repository = db ? new DrizzleRefreshTokenFamilyRepository(db, logout) : undefined;
  const subjectId = "90000000-0000-4000-8000-000000000097";
  const clientId = "refresh-family-test-client";
  const applicationId = "refresh-family-test-app";
  const sessionId = "refresh-family-test-session";
  const currentTokenId = "refresh-family-current";
  const successorTokenId = "refresh-family-successor";
  const failedSuccessorTokenId = "refresh-family-failed-successor";
  const tokenIds = [currentTokenId, successorTokenId, failedSuccessorTokenId];
  const now = new Date();

  async function clearFixture(): Promise<void> {
    if (!db) return;
    await db.delete(session).where(eq(session.id, sessionId));
    await db.delete(oauthAccessToken).where(inArray(oauthAccessToken.id, tokenIds));
  }

  beforeEach(async () => {
    if (!db) return;
    logout.revokeSubject.mockClear();
    await db
      .insert(user)
      .values({
        id: subjectId,
        name: "Refresh Family Test",
        email: "refresh-family-test@lax.bid",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db
      .insert(oauthApplication)
      .values({
        id: applicationId,
        name: "Refresh Family Test",
        clientId,
        redirectUrls: "http://localhost:3010/auth/callback",
        type: "web",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await clearFixture();
    await db.insert(oauthAccessToken).values([
      {
        id: currentTokenId,
        accessToken: "refresh-family-access-current",
        refreshToken: "refresh-family-raw-current",
        accessTokenExpiresAt: new Date(now.getTime() + 60_000),
        refreshTokenExpiresAt: new Date(now.getTime() + 120_000),
        clientId,
        userId: subjectId,
        scopes: "openid",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: successorTokenId,
        accessToken: "refresh-family-access-successor",
        refreshToken: `h1:${hashRefreshToken("refresh-family-raw-successor")}`,
        accessTokenExpiresAt: new Date(now.getTime() + 60_000),
        refreshTokenExpiresAt: new Date(now.getTime() + 120_000),
        clientId,
        userId: subjectId,
        scopes: "openid",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: failedSuccessorTokenId,
        accessToken: "refresh-family-access-failed-successor",
        refreshToken: `h1:${hashRefreshToken("refresh-family-raw-failed-successor")}`,
        accessTokenExpiresAt: new Date(now.getTime() + 60_000),
        refreshTokenExpiresAt: new Date(now.getTime() + 120_000),
        clientId,
        userId: subjectId,
        scopes: "openid",
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  afterAll(async () => {
    if (!db) return;
    await clearFixture();
    await db.delete(oauthApplication).where(eq(oauthApplication.id, applicationId));
    await db.delete(user).where(eq(user.id, subjectId));
  });

  it("finds a raw token and initializes its stable family and hash", async () => {
    if (!repository || !db) return;
    await expect(repository.findAndPrepare("refresh-family-raw-current")).resolves.toMatchObject({
      tokenId: currentTokenId,
      userId: subjectId,
      familyId: currentTokenId,
    });

    const [stored] = await db
      .select({
        familyId: oauthAccessToken.refreshFamilyId,
        hash: oauthAccessToken.refreshTokenHash,
      })
      .from(oauthAccessToken)
      .where(eq(oauthAccessToken.id, currentTokenId));
    expect(stored).toEqual({
      familyId: currentTokenId,
      hash: hashRefreshToken("refresh-family-raw-current"),
    });
  });

  it("links the successor and consumes the predecessor atomically", async () => {
    if (!repository || !db) return;
    await repository.completeRotation({
      consumedTokenId: currentTokenId,
      newRawToken: "refresh-family-raw-successor",
      familyId: "refresh-family-stable",
    });

    const rows = await db
      .select({
        id: oauthAccessToken.id,
        familyId: oauthAccessToken.refreshFamilyId,
        hash: oauthAccessToken.refreshTokenHash,
        consumedAt: oauthAccessToken.refreshConsumedAt,
      })
      .from(oauthAccessToken)
      .where(inArray(oauthAccessToken.id, [currentTokenId, successorTokenId]));
    expect(rows.find((row) => row.id === currentTokenId)?.consumedAt).toBeInstanceOf(Date);
    expect(rows.find((row) => row.id === successorTokenId)).toMatchObject({
      familyId: "refresh-family-stable",
      hash: hashRefreshToken("refresh-family-raw-successor"),
    });
  });

  it("deletes an untracked successor when rotation cannot consume its predecessor", async () => {
    if (!repository || !db) return;
    await expect(
      repository.completeRotation({
        consumedTokenId: "missing-predecessor",
        newRawToken: "refresh-family-raw-failed-successor",
        familyId: "refresh-family-stable",
      }),
    ).rejects.toThrow("OIDC refresh predecessor row was not found");

    const failedSuccessor = await db
      .select({ id: oauthAccessToken.id })
      .from(oauthAccessToken)
      .where(eq(oauthAccessToken.id, failedSuccessorTokenId));
    expect(failedSuccessor).toEqual([]);
  });

  it("revokes family tokens and subject sessions before dispatching logout", async () => {
    if (!repository || !db) return;
    await db
      .update(oauthAccessToken)
      .set({ refreshFamilyId: "refresh-family-revoked" })
      .where(inArray(oauthAccessToken.id, [currentTokenId, successorTokenId]));
    await db.insert(session).values({
      id: sessionId,
      token: "refresh-family-session-token",
      userId: subjectId,
      expiresAt: new Date(now.getTime() + 120_000),
      createdAt: now,
      updatedAt: now,
    });

    await repository.revokeFamily("refresh-family-revoked", subjectId);

    await expect(
      db
        .select({ id: oauthAccessToken.id })
        .from(oauthAccessToken)
        .where(inArray(oauthAccessToken.id, [currentTokenId, successorTokenId])),
    ).resolves.toEqual([]);
    await expect(
      db.select({ id: session.id }).from(session).where(eq(session.id, sessionId)),
    ).resolves.toEqual([]);
    expect(logout.revokeSubject).toHaveBeenCalledWith(subjectId);
  });
});
