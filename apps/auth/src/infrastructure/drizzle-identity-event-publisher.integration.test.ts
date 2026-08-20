import {
  userDeletionCancelledPayloadSchemaV1,
  userDeletionRequestedPayloadSchemaV1,
  userProfileUpdatedPayloadSchemaV1,
} from "@auction/identity-contracts";
import { createIdentityDb } from "@auction/identity-db";
import { identityLifecycleOutbox } from "@auction/identity-db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDrizzleIdentityEventPublisher } from "./drizzle-identity-event-publisher.js";
import { DrizzleSsfSourceEventReader } from "./drizzle-ssf.adapters.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

describeWithDatabase("createDrizzleIdentityEventPublisher transaction", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;

  it("rolls the outbox row back with the state transaction", async () => {
    if (!db) return;
    const subjectId = `outbox-rollback-${crypto.randomUUID()}`;
    const publisher = createDrizzleIdentityEventPublisher(db);

    await expect(
      db.transaction(async (tx) => {
        await publisher.publish(
          { type: "user.profile_updated", userId: subjectId, name: "Rollback" },
          { transaction: tx },
        );
        throw new Error("force_rollback");
      }),
    ).rejects.toThrow("force_rollback");

    const rows = await db
      .select({ id: identityLifecycleOutbox.id })
      .from(identityLifecycleOutbox)
      .where(
        and(
          eq(identityLifecycleOutbox.aggregateId, subjectId),
          eq(identityLifecycleOutbox.eventType, "user.profile_updated"),
        ),
      );
    expect(rows).toEqual([]);
  });

  it("rolls a credential-change event back with a failed password transaction", async () => {
    if (!db) return;
    const subjectId = `password-rollback-${crypto.randomUUID()}`;
    const publisher = createDrizzleIdentityEventPublisher(db);

    await expect(
      db.transaction(async (tx) => {
        await publisher.publish(
          {
            type: "user.credential_changed",
            userId: subjectId,
            changeType: "update",
          },
          { transaction: tx },
        );
        throw new Error("password_update_failed");
      }),
    ).rejects.toThrow("password_update_failed");

    const rows = await db
      .select({ id: identityLifecycleOutbox.id })
      .from(identityLifecycleOutbox)
      .where(
        and(
          eq(identityLifecycleOutbox.aggregateId, subjectId),
          eq(identityLifecycleOutbox.eventType, "user.credential_changed"),
        ),
      );
    expect(rows).toEqual([]);
  });

  it("persists profile image and deletion lifecycle contract payloads", async () => {
    if (!db) return;
    const subjectId = `publisher-contract-${crypto.randomUUID()}`;
    const publisher = createDrizzleIdentityEventPublisher(db);

    try {
      await publisher.publish({
        type: "user.profile_updated",
        userId: subjectId,
        image: null,
      });
      await publisher.publish({ type: "user.deletion_requested", userId: subjectId });
      await publisher.publish({ type: "user.deletion_cancelled", userId: subjectId });

      const rows = await db
        .select({
          eventType: identityLifecycleOutbox.eventType,
          payload: identityLifecycleOutbox.payload,
        })
        .from(identityLifecycleOutbox)
        .where(eq(identityLifecycleOutbox.aggregateId, subjectId));
      const payloadByType = new Map(rows.map((row) => [row.eventType, row.payload]));

      expect(
        userProfileUpdatedPayloadSchemaV1.parse(payloadByType.get("user.profile_updated")),
      ).toMatchObject({ subjectId, image: null });
      expect(
        userDeletionRequestedPayloadSchemaV1.parse(payloadByType.get("user.deletion_requested")),
      ).toMatchObject({ subjectId });
      expect(
        userDeletionCancelledPayloadSchemaV1.parse(payloadByType.get("user.deletion_cancelled")),
      ).toMatchObject({ subjectId });
    } finally {
      await db
        .delete(identityLifecycleOutbox)
        .where(eq(identityLifecycleOutbox.aggregateId, subjectId));
    }
  });

  it("makes security lifecycle events available to the SSF source reader", async () => {
    if (!db) return;
    const publisher = createDrizzleIdentityEventPublisher(db);
    const reader = new DrizzleSsfSourceEventReader(db);
    const subjectIds = {
      credential: `ssf-credential-${crypto.randomUUID()}`,
      deleted: `ssf-deleted-${crypto.randomUUID()}`,
      session: `ssf-session-${crypto.randomUUID()}`,
    };

    try {
      await publisher.publish({
        type: "user.credential_changed",
        userId: subjectIds.credential,
        changeType: "create",
      });
      await publisher.publish({
        type: "user.identity_deleted",
        userId: subjectIds.deleted,
      });
      await publisher.publish({
        type: "user.session_revoked",
        userId: subjectIds.session,
        sessionId: "session-1",
      });

      const inserted = await db
        .select({
          id: identityLifecycleOutbox.id,
          aggregateId: identityLifecycleOutbox.aggregateId,
        })
        .from(identityLifecycleOutbox)
        .where(inArray(identityLifecycleOutbox.aggregateId, Object.values(subjectIds)));
      expect(inserted).toHaveLength(3);

      const firstId = Math.min(...inserted.map((row) => row.id));
      const events = await reader.readUnmapped(
        `ssf-test-${crypto.randomUUID()}`,
        firstId - 1,
        ["user.credential_changed", "user.identity_deleted", "user.session_revoked"],
        10,
      );
      const testEvents = events.filter((event) =>
        Object.values(subjectIds).includes(event.aggregateId),
      );

      expect(testEvents).toHaveLength(3);
      expect(testEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            aggregateId: subjectIds.credential,
            eventType: "user.credential_changed",
            payload: expect.objectContaining({ changeType: "create" }),
          }),
          expect.objectContaining({
            aggregateId: subjectIds.deleted,
            eventType: "user.identity_deleted",
          }),
          expect.objectContaining({
            aggregateId: subjectIds.session,
            eventType: "user.session_revoked",
            payload: expect.objectContaining({ sessionId: "session-1" }),
          }),
        ]),
      );
    } finally {
      await db
        .delete(identityLifecycleOutbox)
        .where(inArray(identityLifecycleOutbox.aggregateId, Object.values(subjectIds)));
    }
  });
});
