import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, createDb } from "../client.js";
import { emailOutbox } from "../schema/email.js";
import {
  backfillCollectionReminderKeys,
  newReminderKey,
} from "./backfill-collection-reminder-keys.js";

const DATABASE_URL = process.env.DATABASE_URL;
const SLOT = "2026-11-10T14:00:00.000Z";
const EMAIL_HASH = "b".repeat(64);

describe("newReminderKey", () => {
  it("uses the account id, else a hash of the lower-cased address", () => {
    const old = `collection-reminder:b-1:${SLOT}:Maya@Example.com`;
    expect(newReminderKey(old, "u1")).toBe(`collection-reminder:b-1:${SLOT}:u1`);
    expect(newReminderKey(old, null)).toMatch(
      new RegExp(`^collection-reminder:b-1:${SLOT}:[0-9a-f]{64}$`),
    );
    expect(newReminderKey(`collection-reminder:b-1:${SLOT}:u1`, "u1")).toBeNull();
  });
});

describe.skipIf(!DATABASE_URL)("collection reminder key backfill", () => {
  const db = DATABASE_URL ? createDb(DATABASE_URL) : undefined;
  const row = (key: string, extra: Record<string, unknown> = {}) => ({
    idempotencyKey: key,
    toEmailHash: EMAIL_HASH,
    template: "collection-reminder",
    vars: {},
    category: "transactional" as const,
    status: "sent" as const,
    ...extra,
  });
  const keys = async () =>
    ((await db?.select({ k: emailOutbox.idempotencyKey }).from(emailOutbox)) ?? [])
      .map((r) => r.k)
      .sort();

  beforeEach(async () => {
    await db?.execute(sql`DELETE FROM email_outbox WHERE template = 'collection-reminder'`);
  });
  afterAll(async () => {
    await db?.execute(sql`DELETE FROM email_outbox WHERE template = 'collection-reminder'`);
    if (db) await closeDb(db);
  });

  it("reports on a dry run, rewrites on apply, and is a no-op on re-run", async () => {
    if (!db) return;
    const old = `collection-reminder:b-1:${SLOT}:maya@example.com`;
    await db.insert(emailOutbox).values(row(old));
    const dry = await backfillCollectionReminderKeys(db, { apply: false, batchSize: 1 });
    expect(dry).toMatchObject({ scanned: 1, rewritten: 1 });
    expect(await keys()).toEqual([old]);
    const applied = await backfillCollectionReminderKeys(db, { apply: true, batchSize: 1 });
    expect(applied.rewritten).toBe(1);
    const after = await keys();
    expect(after).toHaveLength(1);
    expect(after[0]).not.toContain("@");
    expect(await backfillCollectionReminderKeys(db, { apply: true })).toMatchObject({
      scanned: 0,
      rewritten: 0,
    });
    expect(await keys()).toEqual(after);
  });

  it("leaves erased rows alone and skips a row whose new key exists", async () => {
    if (!db) return;
    const erasedKey = `collection-reminder:b-2:${SLOT}:gone@example.com`;
    const dupOld = `collection-reminder:b-3:${SLOT}:dup@example.com`;
    const dupNew = newReminderKey(dupOld, null) as string;
    await db
      .insert(emailOutbox)
      .values([
        row(erasedKey, { lastError: "account_erased", status: "suppressed" }),
        row(`erased:${crypto.randomUUID()}`),
        row(dupOld),
        row(dupNew),
      ]);
    const before = await keys();
    const counts = await backfillCollectionReminderKeys(db, { apply: true });
    expect(counts).toMatchObject({ scanned: 1, rewritten: 0, skippedExisting: 1 });
    expect(await keys()).toEqual(before);
  });
});
