import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0272_purchase_problem.sql");
const rollback = read("0272_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0272 purchase problem", () => {
  it("is journal entry 272, after 0271", () => {
    const entry = journal.entries.find((e) => e.tag === "0272_purchase_problem");
    const previous = journal.entries.find((e) => e.tag === "0271_failed_job_review");
    expect(entry?.idx).toBe(272);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("creates the table with one open report per lot and buying account", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "purchase_problem"');
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "purchase_problem_open_uidx"\s+ON "purchase_problem" \("lot_id", "buyer_legal_entity_id"\)\s+WHERE "status" = 'open'/,
    );
  });

  it("keeps the status, category and resolution consistent", () => {
    expect(migration).toContain('"purchase_problem_status_check"');
    expect(migration).toContain('"purchase_problem_category_check"');
    expect(migration).toContain('"purchase_problem_resolved_check"');
  });

  it("rolls back by dropping the table", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "purchase_problem"');
  });
});
