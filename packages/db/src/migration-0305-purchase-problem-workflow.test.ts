import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0305_purchase_problem_workflow.sql");
const rollback = read("0305_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0305 purchase problem workflow", () => {
  it("follows the entry before it in the journal", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0305_purchase_problem_workflow");
    expect(at).toBeGreaterThan(0);
    expect(journal.entries[at]?.idx).toBe(at);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("adds in progress to the status check and keeps one unresolved report per purchase", () => {
    expect(migration).toContain("CHECK (\"status\" IN ('open', 'in_progress', 'resolved'))");
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "purchase_problem_open_uidx"[\s\S]*WHERE "status" IN \('open', 'in_progress'\)/,
    );
  });

  it("adds the owner, resolver and version columns and the notes table", () => {
    for (const column of ["assigned_to_user_id", "resolved_by_user_id", "version"]) {
      expect(migration).toContain(`"${column}"`);
    }
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "purchase_problem_note"');
  });

  it("rolls back: reports in progress return to open, then the additions are removed", () => {
    expect(rollback).toContain("SET \"status\" = 'open' WHERE \"status\" = 'in_progress'");
    expect(rollback).toContain('DROP TABLE IF EXISTS "purchase_problem_note"');
    expect(rollback).toContain('DROP COLUMN IF EXISTS "assigned_to_user_id"');
    expect(rollback).toContain("CHECK (\"status\" IN ('open', 'resolved'))");
  });
});
