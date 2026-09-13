import { createIdentityDb } from "@auction/identity-db";
import {
  oauthApplication,
  oidcBackchannelLogoutDelivery,
  oidcRpSession,
  session,
  user,
} from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleRpLogoutRepository } from "./drizzle-backchannel-logout.adapters.js";

const DATABASE_URL = process.env.DATABASE_URL;
const NOW = new Date("2026-09-13T04:00:00.000Z");
const SUBJECT_ID = "backchannel-fk-regression-subject";
const CLIENT_ID = "backchannel-fk-regression-client";
const APPLICATION_ID = "backchannel-fk-regression-application";
const SESSION_ID = "backchannel-fk-regression-session";

describe.skipIf(!DATABASE_URL)("drizzle back-channel logout repository", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const repository = db ? new DrizzleRpLogoutRepository(db) : undefined;

  async function clearState(): Promise<void> {
    if (!db) return;
    await db
      .delete(oidcBackchannelLogoutDelivery)
      .where(eq(oidcBackchannelLogoutDelivery.clientId, CLIENT_ID));
    await db.delete(oidcRpSession).where(eq(oidcRpSession.clientId, CLIENT_ID));
    await db.delete(session).where(eq(session.id, SESSION_ID));
    await db.delete(oauthApplication).where(eq(oauthApplication.clientId, CLIENT_ID));
    await db.delete(user).where(eq(user.id, SUBJECT_ID));
  }

  beforeEach(clearState);
  afterAll(clearState);

  it("enqueues logout after Better Auth deletes the linked OP session", async () => {
    if (!db || !repository) return;
    await db.insert(user).values({
      id: SUBJECT_ID,
      name: "Backchannel FK regression",
      email: "backchannel-fk-regression@example.test",
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.insert(oauthApplication).values({
      id: APPLICATION_ID,
      name: "Backchannel FK regression",
      clientId: CLIENT_ID,
      redirectUrls: "https://client.example.test/callback",
      type: "web",
      backchannelLogoutUri: "https://client.example.test/backchannel-logout",
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.insert(session).values({
      id: SESSION_ID,
      token: "backchannel-fk-regression-token",
      userId: SUBJECT_ID,
      expiresAt: new Date(NOW.getTime() + 60_000),
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.insert(oidcRpSession).values({
      clientId: CLIENT_ID,
      subjectId: SUBJECT_ID,
      sid: SESSION_ID,
      identitySessionId: SESSION_ID,
      createdAt: NOW,
      updatedAt: NOW,
      lastSeenAt: NOW,
    });

    // This models Better Auth's end-session handler and the FK's ON DELETE
    // SET NULL effect before createAuthRequestHandler runs security side effects.
    await db.delete(session).where(eq(session.id, SESSION_ID));
    const [orphanedRpSession] = await db
      .select({ identitySessionId: oidcRpSession.identitySessionId })
      .from(oidcRpSession)
      .where(eq(oidcRpSession.sid, SESSION_ID));
    expect(orphanedRpSession?.identitySessionId).toBeNull();

    await expect(repository.revokeIdentitySessionsAndEnqueue([SESSION_ID], NOW)).resolves.toBe(1);
    const [delivery] = await db
      .select()
      .from(oidcBackchannelLogoutDelivery)
      .where(eq(oidcBackchannelLogoutDelivery.clientId, CLIENT_ID));
    expect(delivery).toMatchObject({
      clientId: CLIENT_ID,
      subjectId: SUBJECT_ID,
      sid: SESSION_ID,
      endpoint: "https://client.example.test/backchannel-logout",
      status: "pending",
    });
  });
});
