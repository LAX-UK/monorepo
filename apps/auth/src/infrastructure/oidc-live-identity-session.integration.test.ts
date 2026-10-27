import { createIdentityDb } from "@auction/identity-db";
import { session, user } from "@auction/identity-db/schema";
import { inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleOidcRpSessionRepository } from "./oidc-session-adapters.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("DrizzleOidcRpSessionRepository.findLiveIdentitySession", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const repository = db ? new DrizzleOidcRpSessionRepository(db) : undefined;
  const subjectId = "90000000-0000-4000-8000-000000000123";
  const liveId = "live-identity-session-test-live";
  const expiredId = "live-identity-session-test-expired";
  const now = new Date();

  beforeEach(async () => {
    if (!db) return;
    await db
      .insert(user)
      .values({
        id: subjectId,
        name: "Live Session Test",
        email: "live-session-test@lax.bid",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db.delete(session).where(inArray(session.id, [liveId, expiredId]));
    await db.insert(session).values([
      {
        id: liveId,
        token: "live-identity-session-test-token-live",
        userId: subjectId,
        expiresAt: new Date(now.getTime() + 60_000),
        createdAt: now,
        updatedAt: now,
        lastPasswordAuthAt: now,
      },
      {
        id: expiredId,
        token: "live-identity-session-test-token-expired",
        userId: subjectId,
        expiresAt: new Date(now.getTime() - 60_000),
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(session).where(inArray(session.id, [liveId, expiredId]));
  });

  it("returns a session that is still signed in", async () => {
    await expect(repository?.findLiveIdentitySession(liveId, now)).resolves.toMatchObject({
      id: liveId,
      subjectId,
      mfaCompletedAt: null,
    });
  });

  it("ignores expired and unknown sessions", async () => {
    await expect(repository?.findLiveIdentitySession(expiredId, now)).resolves.toBeNull();
    await expect(repository?.findLiveIdentitySession("no-such-session", now)).resolves.toBeNull();
  });
});
