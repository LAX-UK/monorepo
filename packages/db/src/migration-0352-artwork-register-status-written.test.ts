import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { artworkRegister } from "./schema/artwork-register.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0352_artwork_register_status_written.sql");
const rollback = read("0352_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0352 artwork register status written", () => {
  it("is journalled right after 0351, later than it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0352_artwork_register_status_written");
    expect(journal.entries[at - 1]?.tag).toBe("0351_payment_checkout_session_parameters");
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
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
