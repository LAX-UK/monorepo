import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  privateSaleDeal,
  privateSaleDealDocument,
  privateSaleDealParty,
  privateSaleDealStageHistory,
} from "./schema/private-sale-deal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0295_private_sale_deal.sql");
const rollback = read("0295_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0295 private sale deal", () => {
  it("is journalled after 0286", () => {
    const entry = journal.entries.find((e) => e.tag === "0295_private_sale_deal");
    const previous = journal.entries.find((e) => e.tag === "0286_unsold_lot_follow_up");
    expect(entry?.idx).toBe(295);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("is additive and idempotent", () => {
    expect(migration).not.toMatch(/\bDROP TABLE\b/);
    for (const table of [
      "private_sale_deal",
      "private_sale_deal_party",
      "private_sale_deal_stage_history",
      "private_sale_deal_document",
    ]) {
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
    }
  });

  it("creates every column the schema declares", () => {
    for (const table of [
      privateSaleDeal,
      privateSaleDealParty,
      privateSaleDealStageHistory,
      privateSaleDealDocument,
    ]) {
      for (const column of Object.values(getTableColumns(table))) {
        expect(migration, column.name).toContain(`"${column.name}"`);
      }
    }
  });

  it("keeps the stage history append-only", () => {
    expect(migration).toMatch(/BEFORE UPDATE OR DELETE ON "private_sale_deal_stage_history"/);
  });

  it("does not require the artwork register", () => {
    expect(migration).toMatch(/"artwork_register_id" text,/);
    expect(migration).not.toMatch(/artwork_register_id[^,]*REFERENCES/);
  });

  it("rolls back every table, the guard function and the sequence", () => {
    for (const table of [
      "private_sale_deal_document",
      "private_sale_deal_stage_history",
      "private_sale_deal_party",
      "private_sale_deal",
    ]) {
      expect(rollback).toMatch(new RegExp(`DROP TABLE IF EXISTS "${table}";`));
    }
    expect(rollback).toMatch(/DROP FUNCTION IF EXISTS "private_sale_deal_stage_history_guard"/);
    expect(rollback).toMatch(/DROP SEQUENCE IF EXISTS "private_sale_deal_reference_seq"/);
  });
});
