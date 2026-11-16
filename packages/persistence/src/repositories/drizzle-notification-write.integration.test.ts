import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { notification, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleNotificationWriteRepository } from "./drizzle-notification-write.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("notification writes with a dedupe key (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const writer = new DrizzleNotificationWriteRepository(db);
  const userId = `dedupe-${randomUUID()}`;
  const other = `dedupe-${randomUUID()}`;

  beforeAll(async () => {
    const now = new Date();
    for (const id of [userId, other]) {
      await db.insert(user).values({
        id,
        name: "Ada",
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  afterAll(async () => {
    await db.delete(notification).where(eq(notification.userId, userId));
    await db.delete(notification).where(eq(notification.userId, other));
    await db.delete(user).where(eq(user.id, userId));
    await db.delete(user).where(eq(user.id, other));
  });

  const notice = (to: string, dedupeKey?: string) => ({
    userId: to,
    type: "bidding_limit_changed",
    title: "Your bidding limit changed",
    message: "Northbank Gallery: from £5,000 to £10,000. Bids already placed stand.",
    legalEntityId: null,
    ...(dedupeKey ? { dedupeKey } : {}),
  });

  it("writes a keyed notice once, however often the same event is projected", async () => {
    const key = `bidding-limit-changed:${randomUUID()}:${userId}`;
    expect(await writer.createMany([notice(userId, key)])).toHaveLength(1);
    expect(await writer.createMany([notice(userId, key)])).toEqual([]);
    const rows = await db.select().from(notification).where(eq(notification.dedupeKey, key));
    expect(rows).toHaveLength(1);
  });

  it("skips only the repeated member when a retry covers members already told", async () => {
    const event = randomUUID();
    const first = `bidding-limit-changed:${event}:${userId}`;
    const second = `bidding-limit-changed:${event}:${other}`;
    await writer.createMany([notice(userId, first)]);
    const retried = await writer.createMany([notice(userId, first), notice(other, second)]);
    expect(retried.map((r) => r.userId)).toEqual([other]);
  });

  it("never dedupes notices written without a key", async () => {
    await writer.createMany([notice(userId)]);
    await writer.createMany([notice(userId)]);
    const rows = await db.select().from(notification).where(eq(notification.userId, userId));
    expect(rows.filter((r) => r.dedupeKey === null)).toHaveLength(2);
  });
});
