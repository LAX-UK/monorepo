import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const statements = (sql: string) => sql.replace(/^--.*$/gm, "");
const migration = statements(read("0386_accounting_shop_refunds.sql"));
const rollback = statements(read("0386_rollback.sql"));
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0386_accounting_shop_refunds";

/** api_app's rule as a migration defines it; comments and the blank lines they leave do not count. */
const fn = (sql: string) => {
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION "accounting_document_api_requeue_only"');
  return sql
    .slice(start, sql.indexOf("$fn$;", start) + 5)
    .replace(/^\s*--.*$/gm, "")
    .replace(/\n\s*\n/g, "\n");
};

describe("migration 0386 accounting Shop refunds", () => {
  it("is journalled last, right after 0385, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0385_accounting_credit_note_refunds");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(journal.entries.at(-1)?.tag).toBe(TAG);
    const whens = journal.entries.map((e) => e.when);
    expect(new Set(whens).size).toBe(whens.length);
  });

  it("keeps 0385's api_app rule and refuses moving a credit note parked until its account is named", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).not.toMatch(/CREATE TABLE|ALTER TABLE|GRANT|DROP/);
    const gate =
      /IF OLD\."needs_review_reason" = 'accounting_parked_refund_outside_stripe' THEN\s*RAISE EXCEPTION [^;]+;\s*END IF;\s*/;
    expect(fn(migration)).toMatch(gate);
    // Everything else is 0385's function word for word.
    expect(fn(migration).replace(gate, "")).toBe(
      fn(statements(read("0385_accounting_credit_note_refunds.sql"))),
    );
  });

  it("rolls back its ledger row only, keeping the refusal (parked notes stay parked)", () => {
    expect(rollback).not.toMatch(/CREATE|ALTER|DROP|UPDATE/);
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(`created_at = ${when}`);
  });
});
