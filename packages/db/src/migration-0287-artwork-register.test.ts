import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0287_artwork_register.sql");
const rollback = read("0287_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0287 artwork register", () => {
  it("is journal entry 287, after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0287_artwork_register");
    expect(journal.entries[at]?.idx).toBe(287);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("creates the three tables and drops them again", () => {
    for (const table of [
      "artwork_register",
      "artwork_register_event",
      "artwork_register_conflict",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
  });

  it("allows the six offer states and three reference kinds the contract names", () => {
    expect(migration).toContain(
      `"offer_state" IN ('held', 'lax_art', 'bid_sale', 'private_sale', 'sold', 'withdrawn')`,
    );
    expect(migration).toContain(`"offer_ref_kind" IN ('shop_artwork', 'bid_lot', 'private_sale')`);
  });

  it("only allows conflicts on the fields LAX owns", () => {
    expect(migration).toContain(
      `"field" IN ('stockCode', 'kind', 'sourceOriginalId', 'offerState')`,
    );
  });

  it("makes the Zoho product id and the stock code unique", () => {
    expect(migration).toContain('"artwork_register_zoho_product_uid"');
    expect(migration).toContain('"artwork_register_stock_code_uid"');
  });

  it("allows one open conflict per field and makes history append-only", () => {
    expect(migration).toContain('"artwork_register_conflict_open_uid"');
    expect(migration).toContain(`WHERE "status" = 'open'`);
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "artwork_register_event"');
  });

  it("is rerunnable", () => {
    expect(migration).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(migration).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
  });
});
