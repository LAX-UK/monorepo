import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { artworkConsignorLink, consignorAgreement } from "./schema/consignor-agreement.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0407_consignor_agreement";
const migration = read(`${TAG}.sql`);
const rollback = read("0407_rollback.sql");
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
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")")
    .trim();
  while (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  return text;
}

describe("migration 0407 consignor agreement", () => {
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

  it("creates the agreements and the consignor links, and the rollback drops both", () => {
    for (const table of ["consignor_agreement", "artwork_consignor_link"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
    for (const fn of [
      "consignor_agreement_lineage",
      "consignor_agreement_frozen",
      "artwork_consignor_link_reason",
      "artwork_consignor_link_append_only",
    ]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION ${fn}()`);
      expect(rollback).toContain(`DROP FUNCTION IF EXISTS ${fn}();`);
    }
  });

  it("does not touch Bid's consignment_agreement", () => {
    expect(migration).not.toMatch(/"consignment_agreement"/);
    expect(rollback).not.toMatch(/"consignment_agreement"/);
  });

  it("holds the three places, whole minor units and the versioning", () => {
    for (const column of ["covers_lax_bid", "covers_lax_art", "covers_private_sale"]) {
      expect(migration).toContain(`"${column}" boolean NOT NULL`);
    }
    expect(migration).toContain('"lowest_price_pence" integer');
    expect(migration).toContain('"commission_basis_points" integer');
    expect(migration).toContain(`"status" IN ('current', 'replaced', 'retired')`);
    expect(migration).toContain(
      `ON "consignor_agreement" ("agreement_id") WHERE "status" = 'current'`,
    );
    expect(migration).toContain('REFERENCES "shop_party"("id") ON DELETE RESTRICT');
  });

  it("freezes agreements and keeps consignor links append-only, truncation included", () => {
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "consignor_agreement"');
    expect(migration).toMatch(
      /BEFORE TRUNCATE ON "consignor_agreement"\s+FOR EACH STATEMENT EXECUTE FUNCTION consignor_agreement_frozen\(\)/,
    );
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "artwork_consignor_link"');
    expect(migration).toMatch(
      /BEFORE TRUNCATE ON "artwork_consignor_link"\s+FOR EACH STATEMENT EXECUTE FUNCTION artwork_consignor_link_append_only\(\)/,
    );
  });

  it("refuses to roll back while agreements or consignors exist", () => {
    expect(rollback).toMatch(
      /EXISTS \(SELECT 1 FROM "artwork_consignor_link"\) THEN\s+RAISE EXCEPTION/,
    );
    expect(rollback).toMatch(
      /EXISTS \(SELECT 1 FROM "consignor_agreement"\) THEN\s+RAISE EXCEPTION/,
    );
  });

  it("is rerunnable", () => {
    expect(migration).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(migration).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
    for (const match of migration.matchAll(
      /CREATE TRIGGER "([a-z_]+)"\s+\w+ \w+(?: OR \w+)? ON "([a-z_]+)"/g,
    )) {
      expect(migration).toContain(`DROP TRIGGER IF EXISTS "${match[1]}" ON "${match[2]}"`);
    }
  });

  it("is mirrored by the Drizzle schema, every check and index included", () => {
    const dialect = new PgDialect();
    for (const [name, table] of [
      ["consignor_agreement", consignorAgreement],
      ["artwork_consignor_link", artworkConsignorLink],
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
