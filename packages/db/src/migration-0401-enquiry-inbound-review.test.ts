import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0401_enquiry_inbound_review.sql");
const rollback = read("0401_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0401 enquiry inbound review", () => {
  it("is the journal's next entry after 0400, and its rollback removes its own ledger row", () => {
    const entry = journal.entries.find((e) => e.tag === "0401_enquiry_inbound_review");
    const previous = journal.entries.find((e) => e.tag === "0400_unapplied_money_shop_payment_idx");
    expect(entry).toBeDefined();
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(rollback).toContain(`created_at" = ${entry?.when}`);
  });

  it("records the SPF and DKIM result on both tables, from a closed list", () => {
    expect(migration.match(/ADD COLUMN IF NOT EXISTS "spf_result" text/g)).toHaveLength(2);
    expect(migration.match(/ADD COLUMN IF NOT EXISTS "dkim_result" text/g)).toHaveLength(2);
    expect(migration).toContain("'pass', 'pass_unaligned', 'fail', 'none'");
  });

  it("records an SPF pass for a domain not aligned with the sender as its own result", () => {
    expect(migration.match(/'pass', 'pass_unaligned', 'fail', 'softfail'/g)).toHaveLength(2);
  });

  it("lets staff attach held mail and holds unauthenticated mail", () => {
    expect(migration).toContain("'token', 'in_reply_to', 'staff'");
    expect(migration).toContain("'unauthenticated'");
  });

  it("keeps why attached mail was held and the reason staff gave, on staff-attached rows only", () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "held_reason" text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "review_reason" text');
    expect(migration).toMatch(/"held_reason" IS NULL OR \("matched_by" = 'staff'/);
    expect(migration).toMatch(
      /"review_reason" IS NULL OR \("matched_by" = 'staff'\s+AND char_length\("review_reason"\) <= 500\)/,
    );
    expect(rollback).toContain('DROP COLUMN IF EXISTS "held_reason"');
    expect(rollback).toContain('DROP COLUMN IF EXISTS "review_reason"');
  });

  it("rolls back by taking staff-attached mail off threads and restoring the earlier checks", () => {
    for (const fragment of [
      `"matched_by" = 'staff'`,
      `SET "status" = 'pending'`,
      `SET "reason" = 'spf_failed' WHERE "reason" = 'unauthenticated'`,
      `"matched_by" IN ('token', 'in_reply_to')`,
      'DROP COLUMN IF EXISTS "spf_result"',
      'DROP COLUMN IF EXISTS "dkim_result"',
    ]) {
      expect(rollback).toContain(fragment);
    }
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
  });
});
