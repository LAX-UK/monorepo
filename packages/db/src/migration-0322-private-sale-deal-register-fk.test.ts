import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { privateSaleDeal } from "./schema/private-sale-deal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0322_private_sale_deal_register_fk.sql");
const rollback = read("0322_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0322 private sale deal register link", () => {
  it("is journalled one day after 0321", () => {
    const entry = journal.entries.find((e) => e.tag === "0322_private_sale_deal_register_fk");
    const previous = journal.entries.find((e) => e.tag === "0321_alert_match_matched_at_idx");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("stops rather than drop a value that is not a register entry", () => {
    expect(migration).toMatch(/RAISE EXCEPTION/);
    expect(migration).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM "artwork_register"/);
    // The check runs before the column changes type.
    expect(migration.indexOf("RAISE EXCEPTION")).toBeLessThan(migration.indexOf("ALTER COLUMN"));
    expect(migration).not.toMatch(/SET "artwork_register_id" = NULL/);
  });

  it("converts the column to a uuid that references the register, restricting deletes", () => {
    expect(migration).toMatch(/ALTER COLUMN "artwork_register_id" TYPE uuid USING/);
    expect(migration).toMatch(
      /FOREIGN KEY \("artwork_register_id"\) REFERENCES "artwork_register" \("id"\) ON DELETE RESTRICT/,
    );
    expect(migration).toMatch(/SET LOCAL lock_timeout = '30s'/);
  });

  it("has a rollback that returns the column to text and keeps its values", () => {
    expect(rollback).toMatch(
      /DROP CONSTRAINT IF EXISTS "private_sale_deal_artwork_register_id_fk"/,
    );
    expect(rollback).toMatch(/TYPE text USING "artwork_register_id"::text/);
    expect(rollback).not.toMatch(/\bDELETE\b|\bDROP COLUMN\b/);
  });

  it("is mirrored by the schema", () => {
    const config = getTableConfig(privateSaleDeal);
    const column = config.columns.find((c) => c.name === "artwork_register_id");
    expect(column?.columnType).toBe("PgUUID");
    expect(
      config.foreignKeys.some((fk) => fk.reference().columns[0]?.name === "artwork_register_id"),
    ).toBe(true);
    expect(
      config.indexes.some((i) => i.config.name === "private_sale_deal_artwork_register_idx"),
    ).toBe(true);
  });
});
