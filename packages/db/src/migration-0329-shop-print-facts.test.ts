import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { shopEditionFacts, shopPrintParty } from "./schema/shop-commerce.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0329_shop_print_facts.sql");
const rollback = read("0329_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0329 shop print facts", () => {
  it("follows 0328 in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0329_shop_print_facts");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0328_shop_delivery_regions");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds: nothing is dropped, and every new column but the stamp is nullable", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration).toMatch(/SET LOCAL lock_timeout/);
    const columns = getTableColumns(shopEditionFacts);
    for (const key of [
      "printedBy",
      "publishedByKind",
      "publishedByName",
      "certificateAuthorityGivenBy",
      "certificateAuthorityDatedOn",
    ] as const) {
      expect(columns[key].notNull).toBe(false);
    }
    expect(columns.stamp.notNull).toBe(true);
    expect(columns.stamp.default).toBe("none");
  });

  it("checks the stamp, the parties and that an authority is only for a LAX certificate", () => {
    expect(migration).toMatch(/shop_edition_facts_stamp_ck/);
    expect(migration).toMatch(/'publisher_blind', 'printer_blind', 'estate_back'/);
    expect(migration).toMatch(/shop_edition_facts_published_by_ck/);
    expect(migration).toMatch(/"certificate_issuer" = 'lax'/);
    expect(migration).toMatch(
      /\("certificate_authority_given_by" IS NULL\) = \("certificate_authority_dated_on" IS NULL\)/,
    );
  });

  it("keeps the printers and publishers list one spelling per name", () => {
    expect(getTableColumns(shopPrintParty).name.notNull).toBe(true);
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "shop_print_party_name_uid" ON "shop_print_party" \(lower\("name"\)\)/,
    );
  });

  it("is undone by dropping only what it added", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "shop_print_party"/);
    for (const column of [
      "stamp",
      "printed_by",
      "published_by_kind",
      "published_by_name",
      "certificate_authority_given_by",
      "certificate_authority_dated_on",
    ]) {
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
    expect(rollback).not.toMatch(/DROP TABLE(?! IF EXISTS "shop_print_party")/);
  });
});
