import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0308_subject_legal_acceptance.sql");
const rollback = read("0308_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0308 subject legal acceptance", () => {
  it("is journalled after the migrations that precede it", () => {
    const entry = journal.entries.find((e) => e.tag === "0308_subject_legal_acceptance");
    const previous = journal.entries.find((e) => e.tag === "0292_shop_alert_engine");
    expect(entry?.idx).toBe(308);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("creates the table once per document version and rolls it back", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "subject_legal_acceptance"');
    expect(migration).toContain(
      '"subject_legal_acceptance" ("subject_id", "legal_entity", "document_kind", "document_version")',
    );
    expect(rollback).toContain('DROP TABLE IF EXISTS "subject_legal_acceptance"');
  });

  it("keeps the record when the user row is erased, so the user row cannot be deleted under it", () => {
    expect(migration).toContain('REFERENCES "user"("id") ON DELETE RESTRICT');
  });

  it("limits the kinds, companies, products and sources it accepts", () => {
    expect(migration).toContain("'terms','privacy'");
    expect(migration).toContain("'london-auction-xchange','london-art-exchange'");
    expect(migration).toContain("'account','bid','shop','art'");
    expect(migration).toContain("'hosted_sign_up','social_sign_up'");
  });
});
