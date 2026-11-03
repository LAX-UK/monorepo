import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { unsoldLotFollowUp } from "./schema/unsold-lot-follow-up.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0286_unsold_lot_follow_up.sql");
const rollback = read("0286_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0286 unsold lot follow-up", () => {
  it("is journal entry 286, after 0281", () => {
    const entry = journal.entries.find((e) => e.tag === "0286_unsold_lot_follow_up");
    const previous = journal.entries.find(
      (e) => e.tag === "0281_kyc_outcome_sale_cancelled_notices",
    );
    expect(entry?.idx).toBe(286);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("is additive and idempotent", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "unsold_lot_follow_up"/);
    expect(migration).toMatch(/ON CONFLICT DO NOTHING/);
  });

  it("creates every column the schema declares", () => {
    for (const column of Object.values(getTableColumns(unsoldLotFollowUp))) {
      expect(migration, column.name).toContain(`"${column.name}"`);
    }
  });

  it("rolls back by dropping the table", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "unsold_lot_follow_up"/);
  });
});
