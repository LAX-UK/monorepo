import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0266_organisation_contact_details.sql");
const rollback = read("0266_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0266 organisation contact details", () => {
  it("is journal entry 266, after 0265", () => {
    const entry = journal.entries.find((e) => e.tag === "0266_organisation_contact_details");
    const previous = journal.entries.find((e) => e.tag === "0265_consignment_cover_end");
    expect(entry?.idx).toBe(266);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("creates one row per organisation, removed with the organisation", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "legal_entity_contact_details"');
    expect(migration).toContain('"legal_entity_id" uuid PRIMARY KEY NOT NULL');
    expect(migration).toMatch(/REFERENCES "public"\."legal_entity"\("id"\) ON DELETE cascade/);
  });

  it("keeps the change when the person who made it is deleted", () => {
    expect(migration).toMatch(/REFERENCES "public"\."user"\("id"\) ON DELETE set null/);
  });

  it("drops the table on rollback", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "legal_entity_contact_details"');
  });
});
