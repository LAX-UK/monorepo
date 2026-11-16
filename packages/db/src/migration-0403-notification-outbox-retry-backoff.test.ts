import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) => readFileSync(join(drizzleDir, name), "utf8");
const TAG = "0403_notification_outbox_retry_backoff";
const migration = read(`${TAG}.sql`);
const rollback = read("0403_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0403 notification outbox retry backoff", () => {
  it("is the next journal entry after 0402, and its rollback removes its own ledger row", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0402_notice_delivery_preferences");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(rollback).toContain(`WHERE created_at = ${entry?.when};`);
  });

  it("adds a nullable last_attempt_at under a lock timeout, and the rollback drops it", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    expect(migration).toContain(
      'ALTER TABLE "notification_outbox" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone;',
    );
    expect(migration).not.toMatch(/NOT NULL|DEFAULT/);
    expect(rollback).toContain('DROP COLUMN IF EXISTS "last_attempt_at"');
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
  });
});
