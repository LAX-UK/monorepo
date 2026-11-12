import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bidFinanceSetting } from "./schema/bid-finance-setting.js";
import { consignmentAgreement } from "./schema/consignment-agreements.js";
import { saleSellerTerms } from "./schema/sale-seller-terms.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0369_sale_seller_terms";
const migration = read(`${TAG}.sql`);
const rollback = read("0369_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0369 sale seller terms", () => {
  it("follows the entry before it with the next idx and a later stamp, and precedes later ones", () => {
    const at = journal.entries.findIndex((e) => e.tag === TAG);
    expect(at).toBeGreaterThan(0);
    const entry = journal.entries[at];
    const previous = journal.entries[at - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    const next = journal.entries[at + 1];
    if (next) expect(next.when).toBeGreaterThan(entry?.when ?? 0);
  });

  it("creates the tables idempotently and the rollback removes what it added", () => {
    for (const table of ["sale_seller_terms", "bid_finance_setting"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
    for (const column of [
      "source",
      "recorded_by_user_id",
      "signed_document_id",
      "record_reason",
      "replaces_agreement_id",
    ]) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
  });

  it("is the shape the schema reads", () => {
    const termsColumns = Object.values(getTableColumns(saleSellerTerms)).map((c) => c.name);
    for (const column of termsColumns) expect(migration).toContain(`"${column}"`);
    const settingColumns = Object.values(getTableColumns(bidFinanceSetting)).map((c) => c.name);
    for (const column of settingColumns) expect(migration).toContain(`"${column}"`);
    for (const column of [
      "source",
      "recordedByUserId",
      "signedDocumentId",
      "recordReason",
      "replacesAgreementId",
    ]) {
      expect(consignmentAgreement).toHaveProperty(column);
    }
  });
});
