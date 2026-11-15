import type { IdentityEventPublisher } from "@auction/auth";
import { userSignInMethodRemovedPayloadSchemaV1 } from "@auction/identity-contracts";
import { createIdentityDb } from "@auction/identity-db";
import { account, identityLifecycleOutbox, user } from "@auction/identity-db/schema";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createIdentityOperationsService } from "../container/create-identity-operations-service.js";
import { createDrizzleIdentityEventPublisher } from "./drizzle-identity-event-publisher.js";

const DATABASE_URL = process.env.DATABASE_URL;
const NOW = new Date("2026-08-19T00:00:00.000Z");
const subjectId = "90000000-0000-4000-8000-000000000210";
const credentialId = "unlink-event-credential";
const googleId = "unlink-event-google";

/**
 * Removing Google or Apple writes its domain event in the same transaction as the account change:
 * both stand or neither does. If the publish moved outside the transaction, the failing-publish
 * case below would leave the account removed.
 */
describe.skipIf(!DATABASE_URL)("removing a social sign-in records its event atomically", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;

  async function clearState(): Promise<void> {
    if (!db) return;
    await db
      .delete(identityLifecycleOutbox)
      .where(eq(identityLifecycleOutbox.aggregateId, subjectId));
    await db.delete(account).where(eq(account.userId, subjectId));
    await db.delete(user).where(eq(user.id, subjectId));
  }

  beforeEach(async () => {
    if (!db) return;
    await clearState();
    await db.insert(user).values({
      id: subjectId,
      name: "Unlink Event Subject",
      email: "unlink-event@lax.bid",
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.insert(account).values([
      {
        id: credentialId,
        accountId: subjectId,
        providerId: "credential",
        userId: subjectId,
        password: "hash",
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: googleId,
        accountId: "google-unlink-event",
        providerId: "google",
        userId: subjectId,
        createdAt: new Date(NOW.getTime() + 1_000),
        updatedAt: NOW,
      },
    ]);
  });

  afterAll(clearState);

  function serviceWith(publisher: IdentityEventPublisher) {
    if (!db) throw new Error("no database");
    return createIdentityOperationsService({
      db,
      notices: { notify: async () => undefined },
      productSubjectUsage: {
        getSubjectUsage: async () => ({ hasProductProfile: false, hasExternalLink: false }),
      },
      identityEventPublisher: publisher,
    });
  }

  const outboxRows = () =>
    db
      ? db
          .select({
            eventType: identityLifecycleOutbox.eventType,
            payload: identityLifecycleOutbox.payload,
          })
          .from(identityLifecycleOutbox)
          .where(
            and(
              eq(identityLifecycleOutbox.aggregateId, subjectId),
              eq(identityLifecycleOutbox.eventType, "user.sign_in_method_removed"),
            ),
          )
      : Promise.resolve([]);

  const googleRows = () =>
    db
      ? db.select({ id: account.id }).from(account).where(eq(account.id, googleId))
      : Promise.resolve([]);

  it("removes the account and writes the removed event under the agreed name", async () => {
    if (!db) return;
    const service = serviceWith(createDrizzleIdentityEventPublisher(db));

    await service.unlinkSocialSignIn(subjectId, "google", "current-session");

    expect(await googleRows()).toEqual([]);
    const rows = await outboxRows();
    expect(rows).toHaveLength(1);
    expect(userSignInMethodRemovedPayloadSchemaV1.parse(rows[0]?.payload)).toMatchObject({
      subjectId,
      method: "google",
    });
  });

  it("keeps the account and writes no event when the publish fails inside the transaction", async () => {
    if (!db) return;
    const real = createDrizzleIdentityEventPublisher(db);
    const failing: IdentityEventPublisher = {
      async publish(event, options) {
        await real.publish(event, options);
        throw new Error("publish_failed");
      },
    };

    await expect(
      serviceWith(failing).unlinkSocialSignIn(subjectId, "google", "current-session"),
    ).rejects.toThrow("publish_failed");

    expect(await googleRows()).toEqual([{ id: googleId }]);
    expect(await outboxRows()).toEqual([]);
  });
});
