import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0280_deletion_safety.sql");
const rollback = read("0280_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0280 deletion safety", () => {
  it("follows 0278 in the journal", () => {
    const entry = journal.entries.find((e) => e.tag === "0280_deletion_safety");
    const previous = journal.entries.find((e) => e.tag === "0278_enquiry_draft_uploads");
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("adds the hold, reminder and request-date columns where each product reads them", () => {
    for (const fragment of [
      'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_held_at"',
      'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_hold_reasons" jsonb',
      'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_reminder_sent_at"',
      'ALTER TABLE "bid_identity_directory" ADD COLUMN IF NOT EXISTS "deletion_held_at"',
      'ALTER TABLE "bid_identity_directory" ADD COLUMN IF NOT EXISTS "deletion_hold_reasons" jsonb',
      'ALTER TABLE "shop_user_profile" ADD COLUMN IF NOT EXISTS "deletion_requested_at"',
    ]) {
      expect(migration).toContain(fragment);
    }
  });

  it("starts Shop from the requests Bid already mirrors", () => {
    expect(migration).toContain('UPDATE "shop_user_profile" AS profile');
    expect(migration).toContain('directory."deletion_requested_at" IS NOT NULL');
  });

  it("drops everything it added", () => {
    for (const fragment of [
      'DROP INDEX IF EXISTS "bid_identity_directory_deletion_held_idx"',
      'ALTER TABLE "shop_user_profile" DROP COLUMN IF EXISTS "deletion_requested_at"',
      'ALTER TABLE "bid_identity_directory" DROP COLUMN IF EXISTS "deletion_held_at"',
      'ALTER TABLE "bid_identity_directory" DROP COLUMN IF EXISTS "deletion_hold_reasons"',
      'ALTER TABLE "user" DROP COLUMN IF EXISTS "deletion_held_at"',
      'ALTER TABLE "user" DROP COLUMN IF EXISTS "deletion_hold_reasons"',
      'ALTER TABLE "user" DROP COLUMN IF EXISTS "deletion_reminder_sent_at"',
    ]) {
      expect(rollback).toContain(fragment);
    }
  });
});
