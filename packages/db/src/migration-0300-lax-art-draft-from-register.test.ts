import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0300_lax_art_draft_from_register.sql");
const rollback = read("0300_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0300 lax.art draft from the register", () => {
  it("is journalled after the previous migration", () => {
    const entry = journal.entries.find((e) => e.tag === "0300_lax_art_draft_from_register");
    const previous = journal.entries.find(
      (e) => e.tag === "0299_artwork_register_gallery_sale_ref",
    );
    expect(entry?.idx).toBe(300);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("allows one listing per Zoho product and adds the draft event type", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_zoho_product_uid"[\s\S]*WHERE "zoho_product_id" IS NOT NULL/,
    );
    expect(migration).toMatch(/'move_confirmed', 'lax_art_draft_created'/);
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
  });

  it("rolls back only when no draft event exists, then restores the narrower check", () => {
    const guard = rollback.indexOf("lax_art_draft_created");
    const restore = rollback.indexOf("ADD CONSTRAINT");
    expect(guard).toBeGreaterThan(-1);
    expect(restore).toBeGreaterThan(guard);
    expect(rollback).toMatch(/DROP INDEX IF EXISTS "shop_artwork_zoho_product_uid"/);
  });
});
