import { createIdentityDb } from "@auction/identity-db";
import { account, identityLifecycleOutbox, user } from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { reconcileIdentityLifecycleOutbox } from "./identity-lifecycle-reconciliation.schedule.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Identity lifecycle outbox reconciliation integration", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;

  it("repairs each recoverable lifecycle event without repeating snapshots", async () => {
    if (!db) return;
    const subjectId = `lifecycle-reconcile-${crypto.randomUUID()}`;
    const createdAt = new Date("1900-01-01T00:00:00Z");
    const updatedAt = new Date("1900-01-01T00:01:00Z");

    try {
      await db.insert(user).values({
        id: subjectId,
        name: "Lifecycle Reconciliation",
        email: `${subjectId}@example.test`,
        emailVerified: true,
        image: null,
        phoneNumber: null,
        createdAt,
        updatedAt,
      });
      await db.insert(account).values({
        id: `account-${subjectId}`,
        accountId: subjectId,
        providerId: "credential",
        userId: subjectId,
        password: "password-hash",
        createdAt,
        updatedAt,
      });

      await reconcileIdentityLifecycleOutbox(db, new Date("1900-01-01T00:02:00Z"), 1);
      await reconcileIdentityLifecycleOutbox(db, new Date("1900-01-01T00:03:00Z"), 1);

      const rows = await db
        .select({
          eventType: identityLifecycleOutbox.eventType,
          payload: identityLifecycleOutbox.payload,
        })
        .from(identityLifecycleOutbox)
        .where(eq(identityLifecycleOutbox.aggregateId, subjectId));

      expect(rows.map((row) => row.eventType).sort()).toEqual([
        "user.credential_changed",
        "user.email_verified",
        "user.profile_updated",
        "user.registered",
      ]);
      expect(rows.find((row) => row.eventType === "user.profile_updated")?.payload).toMatchObject({
        subjectId,
        image: null,
        phone: null,
      });
    } finally {
      await db
        .delete(identityLifecycleOutbox)
        .where(eq(identityLifecycleOutbox.aggregateId, subjectId));
      await db.delete(account).where(eq(account.userId, subjectId));
      await db.delete(user).where(eq(user.id, subjectId));
    }
  });
});
