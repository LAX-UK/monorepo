import { createIdentityDb } from "@auction/identity-db";
import { account, session, user, verification } from "@auction/identity-db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleIdentityCredentialRepository } from "./drizzle-identity-credential-repository.js";
import { DrizzleIdentityEmailChangeRepository } from "./drizzle-identity-email-change-repository.js";
import { DrizzleIdentitySessionRepository } from "./drizzle-identity-session-repository.js";
import { DrizzleIdentitySubjectRepository } from "./drizzle-identity-subject-repository.js";
import { DrizzleIdentityUnitOfWork } from "./drizzle-identity-unit-of-work.js";
import { DrizzleIdentityVerificationPurger } from "./drizzle-identity-verification-purger.js";

const DATABASE_URL = process.env.DATABASE_URL;
const NOW = new Date("2026-08-19T00:00:00.000Z");
const subjectId = "90000000-0000-4000-8000-000000000110";
const otherSubjectId = "90000000-0000-4000-8000-000000000111";
const subjectIds = [subjectId, otherSubjectId] as const;
const accountIds = ["identity-operations-credential"] as const;
const sessionIds = [
  "identity-operations-session-1",
  "identity-operations-session-2",
  "identity-operations-session-3",
] as const;
const verificationIds = [
  "identity-operations-verification-1",
  "identity-operations-verification-2",
  "identity-operations-verification-3",
  "identity-operations-verification-current",
] as const;

describe.skipIf(!DATABASE_URL)("drizzle identity operations adapters", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const unitOfWork = db ? new DrizzleIdentityUnitOfWork(db) : undefined;
  const subjects = db ? new DrizzleIdentitySubjectRepository(db) : undefined;
  const credentials = db ? new DrizzleIdentityCredentialRepository(db) : undefined;
  const sessions = db ? new DrizzleIdentitySessionRepository(db) : undefined;
  const emailChanges = db ? new DrizzleIdentityEmailChangeRepository(db) : undefined;
  const verifications = db ? new DrizzleIdentityVerificationPurger(db) : undefined;

  async function clearState(): Promise<void> {
    if (!db) return;
    await db.delete(verification).where(inArray(verification.id, [...verificationIds]));
    await db.delete(session).where(inArray(session.id, [...sessionIds]));
    await db.delete(account).where(inArray(account.id, [...accountIds]));
    await db.delete(user).where(inArray(user.id, [...subjectIds]));
  }

  beforeEach(async () => {
    if (!db) return;
    await clearState();
    await db.insert(user).values([
      {
        id: subjectId,
        name: "Identity Operations Subject",
        email: "identity-operations@lax.bid",
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: otherSubjectId,
        name: "Other Identity Operations Subject",
        email: "identity-operations-other@lax.bid",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
  });

  afterAll(clearState);

  it("reports duplicate credential insertion without exposing a database error", async () => {
    if (!unitOfWork || !credentials) return;
    let first: "inserted" | "already_set" | undefined;
    let second: "inserted" | "already_set" | undefined;

    await unitOfWork.transaction(async (transaction) => {
      first = await credentials.insertCredential(transaction, {
        id: accountIds[0],
        subjectId,
        passwordHash: "hash",
        now: NOW,
      });
      second = await credentials.insertCredential(transaction, {
        id: "unused-duplicate-id",
        subjectId,
        passwordHash: "other-hash",
        now: NOW,
      });
    });

    expect(first).toBe("inserted");
    expect(second).toBe("already_set");
    await expect(credentials.listProviders(subjectId)).resolves.toEqual([
      { providerId: "credential", hasPassword: true },
    ]);
  });

  it("deletes all sessions except the explicitly retained token", async () => {
    if (!db || !unitOfWork || !sessions) return;
    await db.insert(session).values(
      sessionIds.map((id, index) => ({
        id,
        token: `identity-operations-token-${index + 1}`,
        userId: subjectId,
        expiresAt: new Date(NOW.getTime() + 60_000),
        createdAt: new Date(NOW.getTime() + index),
        updatedAt: NOW,
      })),
    );
    let deleted = 0;

    await unitOfWork.transaction(async (transaction) => {
      deleted = await sessions.deleteAllSessions(
        transaction,
        subjectId,
        "identity-operations-token-2",
      );
    });

    expect(deleted).toBe(2);
    await expect(
      db.select({ id: session.id }).from(session).where(eq(session.userId, subjectId)),
    ).resolves.toEqual([{ id: sessionIds[1] }]);
  });

  it("persists both email confirmations, detects clashes, and applies the target email", async () => {
    if (!unitOfWork || !emailChanges) return;
    const nextEmail = "identity-operations-next@lax.bid";
    await emailChanges.startChange({
      subjectId,
      newEmail: nextEmail,
      expiresAt: new Date(NOW.getTime() + 60_000),
      now: NOW,
    });

    await unitOfWork.transaction(async (transaction) => {
      await emailChanges.markConfirmed(transaction, subjectId, "old", NOW);
      await emailChanges.markConfirmed(transaction, subjectId, "new", NOW);
      const confirmed = await emailChanges.loadForConfirmation(transaction, subjectId);
      expect(confirmed).toMatchObject({
        pendingNewEmail: nextEmail,
        emailChangeOldOk: true,
        emailChangeNewOk: true,
      });
      await expect(
        emailChanges.findEmailOwner(transaction, "identity-operations-other@lax.bid", subjectId),
      ).resolves.toBe(otherSubjectId);
      await emailChanges.applyPendingEmail(transaction, subjectId, nextEmail, NOW);
    });

    await expect(emailChanges.readPending(subjectId)).resolves.toBeNull();
    await expect(subjects?.findByEmail(nextEmail)).resolves.toMatchObject({
      id: subjectId,
      email: nextEmail,
      emailVerified: true,
    });
  });

  it("rolls subject deletion back when the unit of work fails", async () => {
    if (!unitOfWork || !subjects) return;

    await expect(
      unitOfWork.transaction(async (transaction) => {
        await subjects.lockForCompensation(transaction, subjectId);
        await subjects.deleteSubject(transaction, subjectId);
        throw new Error("compensation rejected");
      }),
    ).rejects.toThrow("compensation rejected");

    await expect(subjects.findById(subjectId)).resolves.toMatchObject({ id: subjectId });
  });

  it("purges expired verifications in bounded batches", async () => {
    if (!db || !verifications) return;
    await db.insert(verification).values([
      ...verificationIds.slice(0, 3).map((id) => ({
        id,
        identifier: id,
        value: "value",
        expiresAt: new Date(NOW.getTime() - 1),
        createdAt: NOW,
        updatedAt: NOW,
      })),
      {
        id: verificationIds[3],
        identifier: verificationIds[3],
        value: "value",
        expiresAt: new Date(NOW.getTime() + 60_000),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    await expect(verifications.purgeExpired(NOW, 2)).resolves.toBe(2);
    const remaining = await db
      .select({ id: verification.id })
      .from(verification)
      .where(inArray(verification.id, [...verificationIds]));
    expect(remaining).toHaveLength(2);
    expect(remaining).toEqual(
      expect.arrayContaining([{ id: verificationIds[2] }, { id: verificationIds[3] }]),
    );
  });
});
