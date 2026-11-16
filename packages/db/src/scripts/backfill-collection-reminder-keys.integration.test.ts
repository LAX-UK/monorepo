import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, createDb } from "../client.js";
import { emailOutbox } from "../schema/email.js";
import {
  backfillCollectionReminderKeys,
  main,
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

  it("walks several batches, and a dry run counts exactly what apply then does", async () => {
    if (!db) return;
    const olds = [1, 2, 3, 4, 5].map((n) => `collection-reminder:b-${n}:${SLOT}:p${n}@example.com`);
    await db.insert(emailOutbox).values(olds.map((key) => row(key)));
    const dry = await backfillCollectionReminderKeys(db, { apply: false, batchSize: 2 });
    expect(dry).toEqual({ scanned: 5, rewritten: 5, skippedExisting: 0, skippedUnparsable: 0 });
    expect(await keys()).toEqual([...olds].sort());
    const applied = await backfillCollectionReminderKeys(db, { apply: true, batchSize: 2 });
    expect(applied).toEqual(dry);
    expect((await keys()).some((k) => k.includes("@"))).toBe(false);
  });

  it("counts old keys that map to one new key once, in the dry run as in apply", async () => {
    if (!db) return;
    // The same booking, slot and address in two cases: one hash, so one new key.
    const a = `collection-reminder:b-9:${SLOT}:Maya@Example.com`;
    const b = `collection-reminder:b-9:${SLOT}:maya@example.com`;
    await db.insert(emailOutbox).values([row(a), row(b)]);
    const dry = await backfillCollectionReminderKeys(db, { apply: false, batchSize: 1 });
    expect(dry).toMatchObject({ scanned: 2, rewritten: 1, skippedExisting: 1 });
    const applied = await backfillCollectionReminderKeys(db, { apply: true, batchSize: 1 });
    expect(applied).toEqual(dry);
    expect(await keys()).toHaveLength(2);
    expect(new Set(await keys()).size).toBe(2);
  });

  it("is a dry run unless --apply is given", async () => {
    if (!db || !DATABASE_URL) return;
    const old = `collection-reminder:b-7:${SLOT}:dry@example.com`;
    await db.insert(emailOutbox).values(row(old));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const saved = process.env.DATABASE_URL_OWNER;
    process.env.DATABASE_URL_OWNER = DATABASE_URL;
    try {
      await main([]);
      expect(await keys()).toEqual([old]);
      expect(log.mock.calls.at(-1)?.[0]).toContain("dry run");
      await main(["--apply"]);
      expect(await keys()).not.toEqual([old]);
    } finally {
      log.mockRestore();
      if (saved === undefined) process.env.DATABASE_URL_OWNER = undefined;
      else process.env.DATABASE_URL_OWNER = saved;
    }
  });

  it("takes no row lock on a dry run, and gives up on a locked row on apply", async () => {
    if (!db || !DATABASE_URL) return;
    const old = `collection-reminder:b-8:${SLOT}:busy@example.com`;
    await db.insert(emailOutbox).values(row(old));
    const holder = new pg.Client({ connectionString: DATABASE_URL });
    await holder.connect();
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT 1 FROM email_outbox WHERE idempotency_key = $1 FOR UPDATE", [old]);
      // No FOR UPDATE on a dry run: it reads past the held row at once.
      const dry = await backfillCollectionReminderKeys(db, { apply: false, lockTimeoutMs: 200 });
      expect(dry).toMatchObject({ scanned: 1, rewritten: 1 });
      // Apply waits for the lock only as long as lock_timeout, then rolls the batch back.
      const started = Date.now();
      await expect(
        backfillCollectionReminderKeys(db, { apply: true, lockTimeoutMs: 200 }),
      ).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(5000);
      expect(await keys()).toEqual([old]);
    } finally {
      await holder.query("ROLLBACK");
      await holder.end();
    }
    expect(await backfillCollectionReminderKeys(db, { apply: true })).toMatchObject({
      rewritten: 1,
    });
  });
});
