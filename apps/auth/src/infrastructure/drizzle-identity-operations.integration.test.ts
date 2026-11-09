import { createIdentityDb } from "@auction/identity-db";
import { account, passkey, session, user, verification } from "@auction/identity-db/schema";
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
const accountIds = [
  "identity-operations-credential",
  "identity-operations-google",
  "identity-operations-apple",
] as const;
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
    await db.delete(passkey).where(inArray(passkey.userId, [...subjectIds]));
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

  it("lists, locks and removes only the person's own linked social account", async () => {
    if (!db || !unitOfWork || !credentials) return;
    await db.insert(account).values([
      {
        id: accountIds[0],
        accountId: subjectId,
        providerId: "credential",
        userId: subjectId,
        password: "hash",
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: accountIds[1],
        accountId: "google-1",
        providerId: "google",
        userId: subjectId,
        createdAt: new Date(NOW.getTime() + 1_000),
        updatedAt: NOW,
      },
      {
        id: accountIds[2],
        accountId: "apple-1",
        providerId: "apple",
        userId: otherSubjectId,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    const rows = await credentials.listSignInAccounts(subjectId);
    expect(rows.map((row) => [row.providerId, row.hasPassword])).toEqual(
      expect.arrayContaining([
        ["credential", true],
        ["google", false],
      ]),
    );
    expect(rows).toHaveLength(2);

    let removedOther = true;
    let removed = false;
    await unitOfWork.transaction(async (transaction) => {
      expect(await credentials.lockSignInAccounts(transaction, subjectId)).toHaveLength(2);
      removedOther = await credentials.deleteSocialAccount(transaction, subjectId, "apple");
      removed = await credentials.deleteSocialAccount(transaction, subjectId, "google");
    });

    expect(removedOther).toBe(false);
    expect(removed).toBe(true);
    const left = await db
      .select({ id: account.id })
      .from(account)
      .where(inArray(account.id, [...accountIds]));
    expect(left.map((row) => row.id).sort()).toEqual([accountIds[0], accountIds[2]].sort());
  });

  describe("passkeys", () => {
    const passkeyRow = (n: number, userId: string = subjectId) => ({
      id: `identity-operations-passkey-${userId.slice(-3)}-${n}`,
      userId,
      name: `Passkey ${n}`,
      publicKey: `public-key-${userId.slice(-3)}-${n}`,
      credentialId: `credential-${userId.slice(-3)}-${n}`,
      deviceType: "multiDevice" as const,
      backedUp: true,
      transports: "internal",
      createdAt: new Date(NOW.getTime() + n * 1_000),
    });

    it("renames and removes only the person's own passkey, answering null for anyone else's", async () => {
      if (!db || !unitOfWork || !credentials) return;
      await db.insert(passkey).values([passkeyRow(1), passkeyRow(1, otherSubjectId)]);
      const mine = passkeyRow(1);
      const theirs = passkeyRow(1, otherSubjectId);

      expect(await credentials.renamePasskey(subjectId, theirs.id, "Taken over")).toBeNull();
      expect(await credentials.renamePasskey(subjectId, mine.id, "Work laptop")).toMatchObject({
        id: mine.id,
        name: "Work laptop",
      });

      let removedTheirs: unknown = "unset";
      let removedMine: unknown = "unset";
      await unitOfWork.transaction(async (transaction) => {
        removedTheirs = await credentials.deletePasskey(transaction, subjectId, theirs.id);
        removedMine = await credentials.deletePasskey(transaction, subjectId, mine.id);
      });
      expect(removedTheirs).toBeNull();
      expect(removedMine).toEqual({ name: "Work laptop" });
      const left = await db
        .select({ id: passkey.id })
        .from(passkey)
        .where(inArray(passkey.userId, [...subjectIds]));
      expect(left.map((row) => row.id)).toEqual([theirs.id]);
    });

    it("locks the passkey rows after the account rows, counting exactly the person's own", async () => {
      if (!db || !unitOfWork || !credentials) return;
      await db
        .insert(passkey)
        .values([passkeyRow(1), passkeyRow(2), passkeyRow(1, otherSubjectId)]);
      let held = -1;
      await unitOfWork.transaction(async (transaction) => {
        await credentials.lockSignInAccounts(transaction, subjectId);
        held = await credentials.lockPasskeys(transaction, subjectId);
      });
      expect(held).toBe(2);
    });

    it("refuses an eleventh passkey with SQLSTATE 23514 and the passkey_limit message, from the database itself", async () => {
      if (!db) return;
      const ten = Array.from({ length: 10 }, (_, index) => passkeyRow(index + 1));
      await db.insert(passkey).values(ten);
      const attempt = db.insert(passkey).values(passkeyRow(11));
      await expect(attempt).rejects.toSatisfy((error: unknown) => {
        const found = error as { code?: string; cause?: { code?: string; message?: string } };
        const code = found.code ?? found.cause?.code;
        const message = String((error as Error).message) + String(found.cause?.message ?? "");
        return code === "23514" && message.includes("passkey_limit");
      });
      // Another person is unaffected by the first person's ten.
      await db.insert(passkey).values(passkeyRow(1, otherSubjectId));
    });
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

  describe("claiming an address that another change holds", () => {
    const target = "identity-operations-contested@lax.bid";
    const live = new Date(NOW.getTime() + 60_000);
    const expired = new Date(NOW.getTime() - 60_000);

    async function holdAs(id: string, expiresAt: Date): Promise<void> {
      await db
        ?.update(user)
        .set({ pendingNewEmail: target, emailChangeExpiresAt: expiresAt })
        .where(eq(user.id, id));
    }

    async function readPendingRow(id: string) {
      const [row] = (await db
        ?.select({ pending: user.pendingNewEmail, expires: user.emailChangeExpiresAt })
        .from(user)
        .where(eq(user.id, id))) ?? [undefined];
      return row;
    }

    it("is not blocked by another person's expired change", async () => {
      if (!emailChanges) return;
      await holdAs(otherSubjectId, expired);
      await expect(
        emailChanges.startChange({ subjectId, newEmail: target, expiresAt: live, now: NOW }),
      ).resolves.toBe("started");
      expect((await readPendingRow(subjectId))?.pending).toBe(target);
      expect((await readPendingRow(otherSubjectId))?.pending).toBeNull();
    });

    it("is still blocked by another person's live change", async () => {
      if (!emailChanges) return;
      await holdAs(otherSubjectId, live);
      await expect(
        emailChanges.startChange({ subjectId, newEmail: target, expiresAt: live, now: NOW }),
      ).resolves.toBe("address_pending");
      expect((await readPendingRow(subjectId))?.pending).toBeNull();
      expect((await readPendingRow(otherSubjectId))?.pending).toBe(target);
    });

    it("never blocks a sign-up, which claims the email column and not the pending one", async () => {
      if (!db) return;
      await holdAs(otherSubjectId, expired);
      await expect(
        db.insert(user).values({
          id: "90000000-0000-4000-8000-000000000112",
          name: "Sign-up",
          email: target,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      ).resolves.toBeDefined();
      await db.delete(user).where(eq(user.id, "90000000-0000-4000-8000-000000000112"));
    });

    it("sweeps only expired changes", async () => {
      if (!emailChanges) return;
      await holdAs(otherSubjectId, expired);
      await db
        ?.update(user)
        .set({ pendingNewEmail: "identity-operations-live@lax.bid", emailChangeExpiresAt: live })
        .where(eq(user.id, subjectId));
      const cleared = await emailChanges.clearExpired(NOW);
      expect(cleared).toBeGreaterThanOrEqual(1);
      expect((await readPendingRow(otherSubjectId))?.pending).toBeNull();
      expect((await readPendingRow(subjectId))?.pending).toBe("identity-operations-live@lax.bid");
    });
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

    await expect(emailChanges.readPending(subjectId)).resolves.toMatchObject({
      pendingNewEmail: null,
    });
    await expect(subjects?.findByEmail(nextEmail)).resolves.toMatchObject({
      id: subjectId,
      email: nextEmail,
      emailVerified: true,
    });
  });

  describe("cancelling a pending change", () => {
    const nextEmail = "identity-operations-cancel@lax.bid";

    it("clears a pending change once, and the second cancel finds nothing", async () => {
      if (!emailChanges) return;
      await emailChanges.startChange({
        subjectId,
        newEmail: nextEmail,
        expiresAt: new Date(NOW.getTime() + 60_000),
        now: NOW,
      });
      await expect(emailChanges.clearPending(subjectId, NOW)).resolves.toBe(true);
      await expect(emailChanges.readPending(subjectId)).resolves.toMatchObject({
        pendingNewEmail: null,
      });
      await expect(emailChanges.clearPending(subjectId, NOW)).resolves.toBe(false);
    });

    it("finds nothing to cancel once the change has been applied, and leaves the new address", async () => {
      if (!unitOfWork || !emailChanges) return;
      await emailChanges.startChange({
        subjectId,
        newEmail: nextEmail,
        expiresAt: new Date(NOW.getTime() + 60_000),
        now: NOW,
      });
      await unitOfWork.transaction(async (transaction) => {
        await emailChanges.applyPendingEmail(transaction, subjectId, nextEmail, NOW);
      });

      await expect(emailChanges.clearPending(subjectId, NOW)).resolves.toBe(false);
      await expect(subjects?.findByEmail(nextEmail)).resolves.toMatchObject({
        id: subjectId,
        email: nextEmail,
      });
    });

    it("clears an expired change too, so a stale row never lingers", async () => {
      if (!emailChanges) return;
      await emailChanges.startChange({
        subjectId,
        newEmail: nextEmail,
        expiresAt: new Date(NOW.getTime() - 60_000),
        now: NOW,
      });
      await expect(emailChanges.clearPending(subjectId, NOW)).resolves.toBe(true);
    });

    it("finds nothing when no change was ever started", async () => {
      if (!emailChanges) return;
      await expect(emailChanges.clearPending(subjectId, NOW)).resolves.toBe(false);
    });
  });

  it("completes a staff-vouched change on the new inbox's confirmation alone", async () => {
    if (!unitOfWork || !emailChanges) return;
    const nextEmail = "identity-operations-vouched@lax.bid";
    await emailChanges.startChange({
      subjectId,
      newEmail: nextEmail,
      expiresAt: new Date(NOW.getTime() + 60_000),
      now: NOW,
    });

    await unitOfWork.transaction(async (transaction) => {
      await emailChanges.markConfirmed(transaction, subjectId, "old", NOW);
    });
    await unitOfWork.transaction(async (transaction) => {
      await expect(emailChanges.loadForConfirmation(transaction, subjectId)).resolves.toMatchObject(
        { emailChangeOldOk: true, emailChangeNewOk: false },
      );
      await emailChanges.markConfirmed(transaction, subjectId, "new", NOW);
      await expect(emailChanges.loadForConfirmation(transaction, subjectId)).resolves.toMatchObject(
        { emailChangeOldOk: true, emailChangeNewOk: true },
      );
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
