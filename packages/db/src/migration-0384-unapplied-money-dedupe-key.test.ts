import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { domainEvent } from "./schema/domain-events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migrationFile = read("0384_unapplied_money_dedupe_key_uid.sql");
/** The statements, without the explanatory comments. */
const migration = migrationFile.replace(/^--.*$/gm, "");
const rollback = read("0384_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0384_unapplied_money_dedupe_key_uid";

describe("migration 0384 unapplied money dedupe key unique index", () => {
  it("is journalled right after 0383, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0383_shop_invoices_books");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    // Later migrations (0385, Bid refunds to Books) follow it; it stays right after 0383.
    expect(journal.entries.findIndex((e) => e.tag === TAG)).toBe(
      journal.entries.findIndex((e) => e.tag === "0383_shop_invoices_books") + 1,
    );
    const times = journal.entries.map((e) => e.when);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1] ?? Number.POSITIVE_INFINITY);
    }
  });

  it("adds one partial unique index on the dedupe key, idempotently, under the lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf("CREATE UNIQUE INDEX"),
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_unapplied_money_dedupe_key_uid"\s+ON "domain_events" \(\("payload"->>'dedupeKey'\)\)\s+WHERE "event_type" = 'payment\.unapplied_money_received';/,
    );
    expect(migration.match(/CREATE (UNIQUE )?INDEX/g)).toHaveLength(1);
    expect(migration).not.toMatch(/CONCURRENTLY|\bDROP\b|ALTER TABLE|\bUPDATE\b|\bDELETE\b/);
    // Grants are unchanged.
    expect(migration).not.toMatch(/\bGRANT\b|\bREVOKE\b/);
  });

  it("checks for existing duplicates first, and says how to check by hand", () => {
    expect(migration.indexOf("HAVING count(*) > 1")).toBeGreaterThan(-1);
    expect(migration.indexOf("HAVING count(*) > 1")).toBeLessThan(
      migration.indexOf("CREATE UNIQUE INDEX"),
    );
    expect(migrationFile).toMatch(/^-- Pre-check, run against the target database/m);
    expect(migrationFile).toMatch(/pg_relation_size\('domain_events'\)/);
  });

  it("has a rollback that runs in one transaction, drops only the index and clears the ledger", () => {
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
    expect(rollback.indexOf("BEGIN;")).toBeLessThan(rollback.indexOf("SET LOCAL lock_timeout"));
    expect(rollback.indexOf("DROP INDEX")).toBeLessThan(rollback.indexOf("COMMIT;"));
    expect(rollback).toContain(
      'DROP INDEX IF EXISTS "domain_events_unapplied_money_dedupe_key_uid"',
    );
    expect(rollback).not.toMatch(/DROP (TABLE|COLUMN)|ALTER TABLE|\bGRANT\b|\bREVOKE\b/);
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(
      `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${when};`,
    );
  });

  it("declares the index in the schema", () => {
    const index = getTableConfig(domainEvent).indexes.find(
      (i) => i.config.name === "domain_events_unapplied_money_dedupe_key_uid",
    );
    expect(index?.config.unique).toBe(true);
  });
});
