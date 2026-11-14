import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const statements = (sql: string) => sql.replace(/^--.*$/gm, "");
const migration = statements(read("0385_accounting_credit_note_refunds.sql"));
const rollback = statements(read("0385_rollback.sql"));
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0385_accounting_credit_note_refunds";

describe("migration 0385 accounting credit note refunds", () => {
  it("is journalled last, right after 0384, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0384_unapplied_money_dedupe_key_uid");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(journal.entries.at(-1)?.tag).toBe(TAG);
  });

  it("only adds refund_credit_note to the history actions, under the lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(/'apply_remainder', 'refund_credit_note'\)/);
    expect(migration).not.toMatch(/CREATE TABLE|ALTER TABLE "accounting_document" |GRANT/);
  });

  it("rolls back to 0383's actions NOT VALID (rows kept) and removes its own ledger row", () => {
    expect(rollback).toMatch(/'park', 'apply_remainder'\)\s*\) NOT VALID;/);
    expect(rollback).not.toMatch(/refund_credit_note/);
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(`created_at = ${when}`);
  });
});
