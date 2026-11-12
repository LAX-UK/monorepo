import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { impersonationSession, legalEntity, user } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleImpersonationSessionRepository } from "./drizzle-impersonation-session.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleImpersonationSessionRepository (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleImpersonationSessionRepository(db);
  const staffId = `view-staff-${randomUUID()}`;
  const otherStaffId = `view-other-${randomUUID()}`;
  const entityId = randomUUID();
  const now = new Date();

  beforeAll(async () => {
    for (const id of [staffId, otherStaffId]) {
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    await db.insert(legalEntity).values({
      id: entityId,
      displayName: "Viewed client",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: staffId,
      status: "lead",
    });
  });

  afterAll(async () => {
    await db
      .delete(impersonationSession)
      .where(eq(impersonationSession.targetLegalEntityId, entityId));
    await db.delete(legalEntity).where(eq(legalEntity.id, entityId));
    await db.delete(user).where(inArray(user.id, [staffId, otherStaffId]));
  });

  it("ends an open session for its owner, once, and keeps the first reason", async () => {
    const session = await repo.start(staffId, entityId);

    expect(await repo.endForActor(session.id, staffId, "session_replaced")).toBe(true);
    expect(await repo.endForActor(session.id, staffId, "manual")).toBe(false);

    const row = await repo.findById(session.id);
    expect(row?.endedAt).not.toBeNull();
    expect(row?.endReason).toBe("session_replaced");
  });

  it("ends an expired session for its owner but never a live one", async () => {
    const live = await repo.start(staffId, entityId);
    expect(await repo.endExpiredForActor(live.id, staffId, "timeout")).toBe(false);
    expect((await repo.findById(live.id))?.endedAt).toBeNull();

    const expired = await repo.start(staffId, entityId);
    await db
      .update(impersonationSession)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(impersonationSession.id, expired.id));
    expect(await repo.endExpiredForActor(expired.id, otherStaffId, "timeout")).toBe(false);
    expect(await repo.endExpiredForActor(expired.id, staffId, "timeout")).toBe(true);
    expect(await repo.endExpiredForActor(expired.id, staffId, "manual")).toBe(false);
    expect((await repo.findById(expired.id))?.endReason).toBe("timeout");
  });

  it("never ends a session for someone who does not own it", async () => {
    const session = await repo.start(staffId, entityId);

    expect(await repo.endForActor(session.id, otherStaffId, "manual")).toBe(false);

    const row = await repo.findById(session.id);
    expect(row?.endedAt).toBeNull();
    expect(row?.endReason).toBeNull();
    await repo.end(session.id, "manual");
  });

  it("ends inside a caller's transaction and rolls back with it", async () => {
    const session = await repo.start(staffId, entityId);

    await expect(
      db.transaction(async (tx) => {
        const ended = await repo
          .forConnection(tx as never)
          .endForActor(session.id, staffId, "manual");
        expect(ended).toBe(true);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect((await repo.findById(session.id))?.endedAt).toBeNull();
    await repo.end(session.id, "manual");
  });

  it("lists only the actor's own live sessions", async () => {
    const mine = await repo.start(staffId, entityId);
    const theirs = await repo.start(otherStaffId, entityId);
    const ended = await repo.start(staffId, entityId);
    await repo.end(ended.id, "manual");

    const ids = (await repo.listActiveByActor(staffId)).map((s) => s.id);

    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    expect(ids).not.toContain(ended.id);
    await repo.end(mine.id, "manual");
    await repo.end(theirs.id, "manual");
  });
});
