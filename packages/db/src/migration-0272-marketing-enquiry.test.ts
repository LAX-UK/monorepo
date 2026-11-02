import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0272_marketing_enquiry.sql");
const rollback = read("0272_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0272 marketing enquiry", () => {
  it("is journal entry 272, after 0271", () => {
    const entry = journal.entries.find((e) => e.tag === "0272_marketing_enquiry");
    const previous = journal.entries.find((e) => e.tag === "0271_failed_job_review");
    expect(entry?.idx).toBe(272);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("creates the table with the enquiry, its status rules and the new-enquiries index", () => {
    for (const fragment of [
      'CREATE TABLE IF NOT EXISTS "marketing_enquiry"',
      '"topic" text NOT NULL',
      '"email" text NOT NULL',
      '"phone" text,',
      '"message" text NOT NULL',
      '"source_page" text',
      "\"status\" text DEFAULT 'new' NOT NULL",
      "CHECK (\"status\" IN ('new', 'handled'))",
      '("status" = \'handled\') = ("handled_at" IS NOT NULL)',
      'CREATE INDEX IF NOT EXISTS "marketing_enquiry_new_created_idx"',
      "WHERE \"status\" = 'new'",
    ]) {
      expect(migration).toContain(fragment);
    }
    expect(migration.startsWith("--")).toBe(true);
    expect(migration).toContain("SET LOCAL lock_timeout");
  });

  it("rolls back by dropping the table", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "marketing_enquiry"');
  });
});
