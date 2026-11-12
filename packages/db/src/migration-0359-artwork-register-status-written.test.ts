import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { artworkRegister } from "./schema/artwork-register.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0359_artwork_register_status_written.sql");
const rollback = read("0359_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0359 artwork register status written", () => {
  it("is journalled after the previous entry, later than it, with a fixed stamp", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0359_artwork_register_status_written");
    const entry = journal.entries[at];
    const previous = journal.entries[at - 1];
    expect(at).toBeGreaterThan(0);
    expect(previous?.tag).not.toBe(entry?.tag);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe(1806048000000);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    const next = journal.entries[at + 1];
    if (next) expect(next.when).toBeGreaterThan(entry?.when ?? 0);
  });

  it("backfills only still-empty rows from the latest writeback event that matches", () => {
    expect(migration).toContain("'zoho_writeback_recorded'");
    expect(migration).toContain('"catalogue_status_written" IS NULL');
    expect(migration).toContain('r."catalogue_status" = w."status"');
  });

  it("adds one nullable column and widens the conflict field check, idempotently", () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "catalogue_status_written" text;');
    expect(migration).not.toMatch(/NOT NULL/);
    expect(migration).toContain("'offerState', 'catalogueStatus'");
  });

  it("rolls back to the earlier check, refusing while a Status conflict exists", () => {
    expect(rollback).toContain("RAISE EXCEPTION");
    const restored = rollback.slice(rollback.lastIndexOf("ADD CONSTRAINT"));
    expect(restored).not.toContain("catalogueStatus");
    expect(rollback).toContain('DROP COLUMN IF EXISTS "catalogue_status_written"');
  });

  it("matches the schema", () => {
    expect(getTableColumns(artworkRegister).catalogueStatusWritten.name).toBe(
      "catalogue_status_written",
    );
  });
});
