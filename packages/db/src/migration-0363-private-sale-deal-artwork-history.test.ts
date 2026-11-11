import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { privateSaleDealArtworkHistory } from "./schema/private-sale-deal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0363_private_sale_deal_artwork_history";
const migration = read(`${TAG}.sql`);
const rollback = read("0363_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0363 private sale deal artwork history", () => {
  it("sits after the migration before it, in time, and before whatever follows", () => {
    const index = journal.entries.findIndex((e) => e.tag === TAG);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    const next = journal.entries[index + 1];
    expect(index).toBeGreaterThan(0);
    expect(entry?.idx).toBeGreaterThan(previous?.idx ?? 0);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
    if (next) expect(next.when).toBeGreaterThan(entry?.when ?? 0);
  });

  it("only adds a table, with a short lock timeout and nothing destructive", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "private_sale_deal_artwork_history"');
    expect(migration).not.toMatch(/DROP |ALTER TABLE/);
  });

  it("is mirrored by the schema", () => {
    expect(getTableName(privateSaleDealArtworkHistory)).toBe("private_sale_deal_artwork_history");
    const columns = Object.keys(getTableColumns(privateSaleDealArtworkHistory));
    for (const column of ["dealId", "action", "actorUserId", "reason", "toArtworkRegisterId"]) {
      expect(columns).toContain(column);
    }
    const config = getTableConfig(privateSaleDealArtworkHistory);
    expect(config.checks.map((c) => c.name)).toEqual([
      "private_sale_deal_artwork_history_action_check",
      "private_sale_deal_artwork_history_reasons_check",
    ]);
    for (const fk of config.foreignKeys) expect(migration).toContain(fk.getName());
  });

  it("is undone by the rollback", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toContain('DROP TABLE IF EXISTS "private_sale_deal_artwork_history";');
    expect(rollback).toMatch(/COMMIT;/);
  });
});
