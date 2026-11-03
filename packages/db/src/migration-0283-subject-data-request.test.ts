import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATA_REQUEST_CHANNELS,
  DATA_REQUEST_MANUAL_STATUSES,
  DATA_REQUEST_OUTCOMES,
  DATA_REQUEST_PRODUCTS,
  DATA_REQUEST_REASONS,
} from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0283_subject_data_request.sql");
const rollback = read("0283_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

/** The quoted words in the first parenthesised list after `marker`. */
function quoted(sql: string, marker: string): string[] {
  const from = sql.slice(sql.indexOf(marker) + marker.length);
  return [...from.slice(0, from.indexOf(")")).matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? "");
}

const requestTable = migration.slice(
  migration.indexOf('CREATE TABLE IF NOT EXISTS "subject_data_request" ('),
  migration.indexOf('CREATE TABLE IF NOT EXISTS "subject_data_request_audit"'),
);
const auditTable = migration.slice(migration.indexOf('"subject_data_request_audit" ('));

describe("migration 0283 subject data request", () => {
  it("follows 0282 in the journal", () => {
    const entry = journal.entries.find((e) => e.tag === "0283_subject_data_request");
    const previous = journal.entries.find((e) => e.tag === "0282_buyer_default");
    expect(entry?.idx).toBe(283);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("allows exactly the vocabulary the contract defines", () => {
    expect(quoted(requestTable, '"reason" IN (')).toEqual([...DATA_REQUEST_REASONS]);
    expect(quoted(requestTable, '"channel" IN (')).toEqual([...DATA_REQUEST_CHANNELS]);
    expect(quoted(requestTable, '"status" IN (')).toEqual([...DATA_REQUEST_MANUAL_STATUSES]);
    expect(quoted(requestTable, '"outcome" IN (')).toEqual([...DATA_REQUEST_OUTCOMES]);
    expect(quoted(requestTable, "ARRAY[")).toEqual([...DATA_REQUEST_PRODUCTS]);
  });

  it("keeps the request when the user or the linked download is deleted", () => {
    expect(requestTable).toContain('"subject_id" text REFERENCES "user"("id") ON DELETE SET NULL');
    expect(requestTable).toContain(
      '"linked_export_id" uuid REFERENCES "subject_data_export"("id") ON DELETE SET NULL',
    );
    expect(requestTable).not.toContain("ON DELETE CASCADE");
    expect(auditTable).not.toMatch(/REFERENCES "user"/);
  });

  it("continues a download only once and numbers requests from their own sequence", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "subject_data_request_linked_export_uidx"',
    );
    expect(migration).toContain(
      'CREATE SEQUENCE IF NOT EXISTS "subject_data_request_reference_seq"',
    );
    expect(requestTable).toContain(
      'CONSTRAINT "subject_data_request_reference_unique" UNIQUE ("reference")',
    );
  });

  it("limits an extension to two months, told on or before the due date", () => {
    expect(requestTable).toContain(`"extended_due_on" <= ("due_on" + interval '2 months')::date`);
    expect(requestTable).toContain('"person_told_on" <= "due_on"');
  });

  it("holds the clock back while waiting for ID and indexes the open view", () => {
    expect(requestTable).toContain(`"status" <> 'waiting_for_id' OR "due_on" IS NULL`);
    expect(migration).toContain('(coalesce("extended_due_on", "due_on"))');
  });

  it("is additive and can be rolled back", () => {
    expect(migration).not.toMatch(/DROP |ALTER TABLE/);
    expect(rollback).toContain('DROP TABLE IF EXISTS "subject_data_request_audit"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "subject_data_request"');
    expect(rollback).toContain('DROP SEQUENCE IF EXISTS "subject_data_request_reference_seq"');
  });
});
