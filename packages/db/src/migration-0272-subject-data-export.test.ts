import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUBJECT_EXPORT_STATUSES } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0272_subject_data_export.sql");
const rollback = read("0272_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

function quoted(sql: string, after: string): string[] {
  const from = sql.slice(sql.indexOf(after) + after.length);
  return [...from.slice(0, from.indexOf(")")).matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? "");
}

describe("migration 0272 subject data export", () => {
  it("is journal entry 272, after 0271", () => {
    const entry = journal.entries.find((e) => e.tag === "0272_subject_data_export");
    const previous = journal.entries.find((e) => e.tag === "0271_failed_job_review");
    expect(entry?.idx).toBe(272);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("allows exactly the statuses the contract defines", () => {
    expect(quoted(migration, '"status" IN (')).toEqual([...SUBJECT_EXPORT_STATUSES]);
  });

  it("allows one open request per person, using the contract's open statuses", () => {
    const index = migration.slice(migration.indexOf("subject_data_export_one_open_uidx"));
    expect(quoted(index, '"status" IN (')).toEqual(["requested", "collecting", "delayed", "ready"]);
  });

  it("keeps the request record when the user row is hard-deleted", () => {
    const requestTable = migration.slice(
      migration.indexOf('CREATE TABLE IF NOT EXISTS "subject_data_export" ('),
      migration.indexOf('CREATE TABLE IF NOT EXISTS "subject_data_export_audit"'),
    );
    expect(requestTable).toContain('"subject_id" text REFERENCES "user"("id") ON DELETE SET NULL');
    expect(requestTable).not.toContain("ON DELETE CASCADE");
    const auditTable = migration.slice(migration.indexOf('"subject_data_export_audit" ('));
    expect(auditTable).not.toMatch(/REFERENCES "user"/);
  });

  it("is additive and can be rolled back", () => {
    expect(migration).not.toMatch(/DROP |ALTER TABLE "(?!subject_data_export)/);
    expect(rollback).toContain('DROP TABLE IF EXISTS "subject_data_export_audit"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "subject_data_export"');
  });
});
