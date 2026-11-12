import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  API_DENY_TABLES,
  WORKER_DENY_TABLES,
  WORKER_ZOHO_BOOKS_SELECT_COLUMNS,
  WORKER_ZOHO_BOOKS_TABLES,
  WORKER_ZOHO_BOOKS_UPDATE_COLUMNS,
} from "./migrate-roles.js";
import { zohoBooksConnection } from "./schema/zoho-books-connection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0369_zoho_books_connection";
const migration = read(`${TAG}.sql`);
const rollback = read("0369_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0369 Zoho Books connection", () => {
  it("is journalled once, after the entry before it and before whatever follows (order-robust)", () => {
    expect(journal.entries.filter((e) => e.tag === TAG)).toHaveLength(1);
    const index = journal.entries.findIndex((e) => e.tag === TAG);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    const next = journal.entries[index + 1];
    expect(index).toBeGreaterThan(0);
    expect(entry?.when).toBe(1809950400000);
    expect(journal.entries.filter((e) => e.idx === entry?.idx)).toHaveLength(1);
    expect(entry?.idx).toBeGreaterThan(previous?.idx ?? Number.POSITIVE_INFINITY);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    if (next) expect(next.when).toBeGreaterThan(entry?.when ?? 0);
  });

  it("only adds a table, with a lock timeout and nothing destructive", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout/);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "zoho_books_connection"');
    expect(migration).not.toMatch(/\b(DROP|ALTER|TRUNCATE|UPDATE|DELETE|INSERT)\b/);
  });

  it("stores tokens sealed only: no plaintext column, envelope CHECKs on both", () => {
    expect(migration).not.toMatch(/"(access|refresh)_token"/);
    expect(migration).toMatch(/"refresh_token_sealed" text NOT NULL/);
    expect(migration).toContain(`CHECK ("refresh_token_sealed" LIKE 'v1:%')`);
    expect(migration).toContain(
      `CHECK ("access_token_sealed" IS NULL OR "access_token_sealed" LIKE 'v1:%')`,
    );
    expect(migration).toContain(`UNIQUE ("organization_id")`);
  });

  it("is mirrored by the schema", () => {
    expect(getTableName(zohoBooksConnection)).toBe("zoho_books_connection");
    const columns = Object.keys(getTableColumns(zohoBooksConnection));
    expect(columns).not.toContain("accessToken");
    expect(columns).not.toContain("refreshToken");
    const config = getTableConfig(zohoBooksConnection);
    for (const check of config.checks) expect(migration).toContain(check.name);
    expect(config.checks).toHaveLength(3);
  });

  it("rolls back by dropping the table", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "zoho_books_connection"');
  });

  it("grants only the worker, by column, and denies the API", () => {
    expect([...WORKER_ZOHO_BOOKS_TABLES]).toEqual(["zoho_books_connection"]);
    expect([...WORKER_DENY_TABLES]).not.toContain("zoho_books_connection");
    expect([...API_DENY_TABLES]).toContain("zoho_books_connection");
    const columns = Object.keys(getTableColumns(zohoBooksConnection)).length;
    expect(WORKER_ZOHO_BOOKS_SELECT_COLUMNS.length).toBeLessThan(columns);
    for (const column of ["id", "created_at"]) {
      expect([...WORKER_ZOHO_BOOKS_SELECT_COLUMNS]).not.toContain(column);
      expect([...WORKER_ZOHO_BOOKS_UPDATE_COLUMNS]).not.toContain(column);
    }
    expect([...WORKER_ZOHO_BOOKS_UPDATE_COLUMNS]).not.toContain("organization_id");
    const roles = readFileSync(join(__dirname, "migrate-roles.ts"), "utf8");
    expect(roles).not.toMatch(/WORKER_ZOHO_BOOKS_TABLES\) \{\s*await grantIfExists/);
  });
});
