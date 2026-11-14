import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0388_data_request_erasure_hold.sql").replace(/^--.*$/gm, "");
const rollback = read("0388_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0388_data_request_erasure_hold";

describe("migration 0388 data request erasure holds", () => {
  it("is journalled last, right after 0387, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0387_accounting_books_status");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(journal.entries.at(-1)?.tag).toBe(TAG);
  });

  it("keeps the journal's idx contiguous and its when strictly increasing", () => {
    for (const [i, e] of journal.entries.entries()) {
      expect(e.idx).toBe(i);
      if (i > 0) expect(e.when).toBeGreaterThan(journal.entries[i - 1]?.when ?? 0);
    }
  });

  it("creates the table under the lock timeout, with a waiting row always due at some time", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout = '5s'")).toBeLessThan(
      migration.indexOf("CREATE TABLE"),
    );
    expect(migration).toMatch(/"state" IN \('waiting', 'needs_staff'\)/);
    expect(migration).toMatch(/"state" <> 'waiting' OR "recheck_at" IS NOT NULL/);
    expect(migration).toMatch(/WHERE "state" = 'waiting'/);
  });

  it("holds no contact details", () => {
    expect(migration).not.toMatch(/email|phone|"name"/i);
  });

  it("rolls back by dropping the table and its ledger row", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "data_request_erasure_hold"/);
    expect(rollback).toContain(`created_at = ${entry?.when}`);
  });
});
