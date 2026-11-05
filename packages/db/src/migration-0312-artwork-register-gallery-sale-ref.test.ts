import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0312_artwork_register_gallery_sale_ref.sql");
const rollback = read("0312_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0312 artwork register gallery sale reference", () => {
  it("is journalled after the previous migration", () => {
    const entry = journal.entries.find((e) => e.tag === "0312_artwork_register_gallery_sale_ref");
    const previous = journal.entries.find((e) => e.tag === "0298_private_sale_deal_payment");
    expect(entry?.idx).toBe(307);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("only widens the reference kinds, keeping the three places", () => {
    expect(migration).toMatch(
      /"offer_ref_kind" IN \('shop_artwork', 'bid_lot', 'private_sale', 'gallery_sale'\)/,
    );
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
  });

  it("rolls back by clearing gallery references before the narrower check returns", () => {
    const clear = rollback.indexOf("WHERE \"offer_ref_kind\" = 'gallery_sale'");
    const restore = rollback.indexOf("ADD CONSTRAINT");
    expect(clear).toBeGreaterThan(-1);
    expect(restore).toBeGreaterThan(clear);
    expect(rollback).toMatch(/IN \('shop_artwork', 'bid_lot', 'private_sale'\)\s*\)/);
  });
});
