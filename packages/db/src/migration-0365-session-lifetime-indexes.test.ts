import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { session } from "@auction/identity-db/schema";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migrationFile = read("0365_session_lifetime_indexes.sql");
/** The statements, without the explanatory comments. */
const migration = migrationFile.replace(/^--.*$/gm, "");
const rollback = read("0365_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0365 session lifetime indexes", () => {
  it("is journalled after 0361, with a later time, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === "0365_session_lifetime_indexes");
    const base = journal.entries.find((e) => e.tag === "0361_oauth_token_sign_in");
    expect(entry?.when).toBe(1807344000000);
    expect(entry?.when).toBeGreaterThan(base?.when ?? Number.POSITIVE_INFINITY);
    // Other migrations may land before or after it; only the ordering rules must hold.
    const times = journal.entries.map((e) => e.when);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1] ?? Number.POSITIVE_INFINITY);
    }
    expect(new Set(journal.entries.map((e) => e.idx)).size).toBe(journal.entries.length);
  });

  it("only adds the signed-in expression index, idempotently, under the lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).not.toMatch(/\bDROP\b|ALTER TABLE|ADD COLUMN|CONCURRENTLY|UPDATE /);
    // Last use is written on every touch: indexing it would stop those updates being HOT.
    expect(migration).not.toContain("session_last_active_idx");
    expect(migration).toMatch(
      /"session_signed_in_idx"\s+ON "session" \(\(coalesce\("signed_in_at", "created_at"\)\)\)/,
    );
    expect(migration.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(1);
  });

  it("has a rollback that runs in one transaction, drops the indexes and says how to clear the ledger", () => {
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
    expect(rollback.indexOf("BEGIN;")).toBeLessThan(rollback.indexOf("SET LOCAL lock_timeout"));
    expect(rollback).toContain(
      "DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1807344000000",
    );
  });

  it("has a rollback that drops the indexes and nothing else", () => {
    expect(rollback).toContain('DROP INDEX IF EXISTS "session_last_active_idx"');
    expect(rollback).toContain('DROP INDEX IF EXISTS "session_signed_in_idx"');
    expect(rollback).not.toMatch(/DROP (TABLE|COLUMN)|ALTER TABLE/);
  });

  it("declares the signed-in index in the schema, and none on last use", () => {
    const names = getTableConfig(session).indexes.map((i) => i.config.name);
    expect(names).not.toContain("session_last_active_idx");
    expect(names).toContain("session_signed_in_idx");
  });
});
