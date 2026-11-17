import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { artworkLocation, artworkLocationMove } from "./schema/artwork-location.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0404_artwork_stock_location";
const migration = read(`${TAG}.sql`);
const rollback = read("0404_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

/** The CHECK constraints a CREATE TABLE in the migration declares, by name, with their bodies. */
function migrationChecks(table: string): Map<string, string> {
  const start = migration.indexOf(`CREATE TABLE IF NOT EXISTS "${table}"`);
  const end = migration.indexOf("--> statement-breakpoint", start);
  const block = migration.slice(start, end);
  const checks = new Map<string, string>();
  for (const match of block.matchAll(/CONSTRAINT "([a-z_]+)" CHECK \(/g)) {
    // The body runs to the bracket that closes the one after CHECK.
    let depth = 1;
    let at = (match.index ?? 0) + match[0].length;
    const from = at;
    for (; depth > 0; at++) {
      if (block[at] === "(") depth++;
      if (block[at] === ")") depth--;
    }
    checks.set(match[1] as string, block.slice(from, at - 1));
  }
  return checks;
}

/** Drops quoting, table qualification, outer brackets and spacing so the two spellings compare. */
function normalise(sql: string): string {
  let text = sql
    .replace(/"[a-z_]+"\./g, "")
    .replaceAll('"', "")
    .replace(/\s+/g, " ")
    .trim();
  while (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  return text;
}

describe("migration 0404 artwork stock location", () => {
  it("is journalled after the entry before it, and the rollback clears its ledger row", () => {
    const at = journal.entries.findIndex((e) => e.tag === TAG);
    const entry = journal.entries[at];
    const previous = journal.entries[at - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(rollback).toContain(
      `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${entry?.when};`,
    );
  });

  it("creates the location list and the moves, and the rollback drops both", () => {
    for (const table of ["artwork_location", "artwork_location_move"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
  });

  it("keeps names unique ignoring case, and only active or retired", () => {
    expect(migration).toContain('ON "artwork_location" (lower("name"))');
    expect(migration).toContain(`"status" IN ('active', 'retired')`);
    expect(migration).toContain('char_length("name") BETWEEN 1 AND 80');
  });

  it("makes moves append-only, with a note of at most 500 characters", () => {
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "artwork_location_move"');
    // TRUNCATE skips row triggers, so it is refused by a statement trigger of its own.
    expect(migration).toMatch(
      /BEFORE TRUNCATE ON "artwork_location_move"\s+FOR EACH STATEMENT EXECUTE FUNCTION artwork_location_move_append_only\(\)/,
    );
    expect(rollback).toContain("DROP FUNCTION IF EXISTS artwork_location_move_append_only();");
    expect(migration).toContain('char_length("note") BETWEEN 1 AND 500');
    expect(migration).toContain('REFERENCES "artwork_location"("id") ON DELETE RESTRICT');
  });

  it("adds location_moved to the history check, and the rollback takes it out again", () => {
    expect(migration).toContain("'location_moved'");
    expect(rollback).not.toContain("'location_moved'");
    // Every type allowed before stays allowed.
    for (const type of ["gallery_sale_reopened", "move_confirmed", "created"]) {
      expect(migration).toContain(`'${type}'`);
      expect(rollback).toContain(`'${type}'`);
    }
  });

  it("refuses to roll back while moves exist, so where artworks are is never lost", () => {
    expect(rollback).toMatch(
      /EXISTS \(SELECT 1 FROM "artwork_location_move"\)[\s\S]*RAISE EXCEPTION/,
    );
  });

  it("is rerunnable", () => {
    expect(migration).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(migration).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
  });

  it("is mirrored by the Drizzle schema, every check and index included", () => {
    const dialect = new PgDialect();
    for (const [name, table] of [
      ["artwork_location", artworkLocation],
      ["artwork_location_move", artworkLocationMove],
    ] as const) {
      const config = getTableConfig(table);
      const fromSchema = new Map(
        config.checks.map((check) => [check.name, dialect.sqlToQuery(check.value).sql]),
      );
      const fromMigration = migrationChecks(name);
      expect([...fromSchema.keys()].sort(), name).toEqual([...fromMigration.keys()].sort());
      for (const [check, body] of fromMigration) {
        expect(normalise(fromSchema.get(check) ?? ""), check).toBe(normalise(body));
      }
      for (const index of config.indexes) {
        expect(migration).toContain(`INDEX IF NOT EXISTS "${index.config.name}"`);
      }
      const indexesInMigration = [
        ...migration.matchAll(/INDEX IF NOT EXISTS "([a-z_]+)"\s+ON "([a-z_]+)"/g),
      ].filter((match) => match[2] === name);
      expect(config.indexes).toHaveLength(indexesInMigration.length);
    }
  });
});
