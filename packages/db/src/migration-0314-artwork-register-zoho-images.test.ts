import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0314_artwork_register_zoho_images.sql");
const rollback = read("0314_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0314 artwork register Zoho images", () => {
  it("is journalled after the previous migration", () => {
    const entry = journal.entries.find((e) => e.tag === "0314_artwork_register_zoho_images");
    const previous = journal.entries.find((e) => e.tag === "0313_lax_art_draft_from_register");
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    // Later migrations may follow it; it only has to come straight after 0313.
    const index = journal.entries.findIndex((e) => e.tag === "0314_artwork_register_zoho_images");
    expect(journal.entries[index - 1]?.tag).toBe("0313_lax_art_draft_from_register");
  });

  it("only adds columns with defaults, a check and an index", () => {
    expect(migration).toMatch(/"image_sources" jsonb NOT NULL DEFAULT '\[\]'/);
    expect(migration).toMatch(/"images_checked_at" timestamp with time zone;/);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS "artwork_register_images_checked_idx"/);
    expect(migration).not.toMatch(/\bDROP\b/);
  });

  it("rolls back by removing exactly what it added", () => {
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "image_sources"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "images_checked_at"/);
    expect(rollback).toMatch(/DROP INDEX IF EXISTS "artwork_register_images_checked_idx"/);
  });
});
