import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0322_zoho_campaigns_suppression.sql");
const rollback = read("0322_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0322 Zoho Campaigns suppression", () => {
  it("is the last journal entry, after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0322_zoho_campaigns_suppression");
    expect(at).toBe(journal.entries.length - 1);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("adds the reason, the source and the watermark table", () => {
    expect(migration).toContain("'unsubscribed_marketing'");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "source"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "zoho_campaigns_suppression_state"');
    expect(migration).toContain(`"mode" IN ('dry_run', 'live')`);
  });

  it("rolls back without losing anyone's opt-out", () => {
    expect(rollback).toContain(
      `SET "reason" = 'unsubscribe' WHERE "reason" = 'unsubscribed_marketing'`,
    );
    expect(rollback).toContain('DROP TABLE IF EXISTS "zoho_campaigns_suppression_state"');
    expect(rollback).toContain('DROP COLUMN IF EXISTS "source"');
    expect(rollback).not.toContain("DELETE FROM");
  });
});
