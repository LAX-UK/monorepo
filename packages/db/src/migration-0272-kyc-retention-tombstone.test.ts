import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0272_kyc_retention_tombstone.sql");
const rollback = read("0272_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0272 KYC retention tombstone", () => {
  it("is journal entry 272, after 0271", () => {
    const entry = journal.entries.find((e) => e.tag === "0272_kyc_retention_tombstone");
    const previous = journal.entries.find((e) => e.tag === "0271_failed_job_review");
    expect(entry?.idx).toBe(272);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("creates the tombstone table with ids, counts and dates only", () => {
    for (const column of [
      '"subject_kind" text NOT NULL',
      '"subject_id" text NOT NULL',
      '"record_kind" text NOT NULL',
      '"records_purged" integer NOT NULL',
      '"relationship_ended_at" timestamp with time zone NOT NULL',
      '"retention_basis" text NOT NULL',
      '"purged_at" timestamp with time zone NOT NULL',
    ]) {
      expect(migration).toContain(column);
    }
  });

  it("is rerunnable and has a rollback", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS");
    expect(rollback).toContain('DROP TABLE IF EXISTS "kyc_retention_tombstone"');
  });
});
