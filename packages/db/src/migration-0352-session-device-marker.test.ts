import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { session, sessionLineage } from "@auction/identity-db/schema";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { API_DENY_TABLES, AUTH_FULL_TABLES, WORKER_DENY_TABLES } from "./migrate-roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0352_session_device_marker.sql");
const rollback = read("0352_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0352 session device marker", () => {
  it("is journalled as entry 346, one day after 0351", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0352_session_device_marker");
    expect(journal.entries[index]?.idx).toBe(346);
    expect(journal.entries[index]?.when).toBe(1805443200000);
    expect(journal.entries[index - 1]?.tag).toBe("0351_payment_checkout_session_parameters");
  });

  it("only adds nullable columns and one table, idempotently, so older records and the previous release keep working", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).not.toMatch(/\bDROP\b|ALTER COLUMN/);
    const alterations = migration.split("\n").filter((line) => line.startsWith("ALTER TABLE"));
    expect(alterations).toHaveLength(4);
    for (const line of alterations) expect(line).not.toMatch(/NOT NULL|DEFAULT/);
    for (const column of ["device_hash", "signed_in_at", "last_seen_at", "country"]) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "session_lineage"/);
    expect(migration).toMatch(
      /"session_id" text NOT NULL REFERENCES "session"\("id"\) ON DELETE CASCADE/,
    );
  });

  it("indexes the device hash with the person", () => {
    expect(migration).toMatch(
      /"session_device_hash_user_idx"\s+ON "session" \("device_hash", "user_id"\) WHERE "device_hash" IS NOT NULL/,
    );
  });

  it("has a rollback that drops the table, the index and every column", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "session_lineage"');
    expect(rollback).toContain('DROP INDEX IF EXISTS "session_device_hash_user_idx"');
    for (const column of ["device_hash", "signed_in_at", "last_seen_at", "country"]) {
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
  });

  it("matches the schema", () => {
    const columns = getTableColumns(session);
    for (const column of [
      columns.deviceHash,
      columns.signedInAt,
      columns.lastSeenAt,
      columns.country,
    ]) {
      expect(column.notNull).toBe(false);
    }
    expect(Object.keys(getTableColumns(sessionLineage)).sort()).toEqual([
      "createdAt",
      "previousSid",
      "sessionId",
      "userId",
    ]);
  });

  it("keeps lineage with the issuer alone: auth_app has it, api_app and worker_app do not", () => {
    const name = getTableName(sessionLineage);
    expect([...AUTH_FULL_TABLES]).toContain(name);
    expect([...API_DENY_TABLES]).toContain(name);
    expect([...WORKER_DENY_TABLES]).toContain(name);
  });
});
