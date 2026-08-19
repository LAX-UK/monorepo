import { createDb } from "@auction/db";
import { identityLifecycleOutbox } from "@auction/identity-db/schema";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDrizzleIdentityEventPublisher } from "./drizzle-identity-event-publisher.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

describeWithDatabase("createDrizzleIdentityEventPublisher transaction", () => {
  const db = DATABASE_URL ? createDb(DATABASE_URL) : undefined;

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
});
