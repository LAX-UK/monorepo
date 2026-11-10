import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sale } from "./schema/sales.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0348_sale_time_zone.sql");
const rollback = read("0348_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0348 sale time zone", () => {
  it("follows an earlier migration in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0348_sale_time_zone");
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(index).toBeGreaterThan(0);
    expect(Number(previous?.tag.slice(0, 4))).toBeLessThan(348);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("backfills every existing sale to London through the column default", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toContain(
      `ADD COLUMN IF NOT EXISTS "time_zone" text NOT NULL DEFAULT 'Europe/London'`,
    );
    expect(migration).toContain(`NOT LIKE 'Etc/%'`);
    expect(migration).not.toMatch(/DROP COLUMN|DROP TABLE/);
  });

  it("stamps already published sales so unpublishing never reopens their zone", () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "first_published_at"');
    expect(migration).toMatch(
      /UPDATE "sale" SET "first_published_at" = "updated_at" WHERE "status" <> 'draft'/,
    );
  });

  it("is mirrored by the schema", () => {
    const column = getTableColumns(sale).timeZone;
    expect(column.name).toBe("time_zone");
    expect(column.notNull).toBe(true);
    expect(column.default).toBe("Europe/London");
    expect(getTableColumns(sale).firstPublishedAt.notNull).toBe(false);
  });

  it("is undone by the rollback", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toContain('DROP CONSTRAINT IF EXISTS "sale_time_zone_names_a_place"');
    expect(rollback).toContain('DROP COLUMN IF EXISTS "time_zone"');
    expect(rollback).toContain('DROP COLUMN IF EXISTS "first_published_at"');
    expect(rollback).toMatch(/COMMIT;/);
  });
});
