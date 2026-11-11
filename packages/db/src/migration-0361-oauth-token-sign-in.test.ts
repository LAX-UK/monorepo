import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { oauthAccessToken, session } from "@auction/identity-db/schema";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0361_oauth_token_sign_in.sql");
const rollback = read("0361_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0361 oauth token sign-in", () => {
  it("is journalled straight after 0356, in order", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0361_oauth_token_sign_in");
    expect(journal.entries[index - 1]?.tag).toBe("0356_session_device_marker");
    expect(journal.entries[index]?.idx).toBe((journal.entries[index - 1]?.idx ?? 0) + 1);
    expect(journal.entries[index]?.when).toBeGreaterThan(journal.entries[index - 1]?.when ?? 0);
  });

  it("only adds one nullable column and one partial index, idempotently", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).not.toMatch(/\bDROP\b|ALTER COLUMN|\bDEFAULT\b|REFERENCES|text NOT NULL/);
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "sid" text');
    expect(migration).toMatch(
      /"oauth_access_token_user_sid_idx"\s+ON "oauth_access_token" \("user_id", "sid"\) WHERE "sid" IS NOT NULL/,
    );
  });

  it("indexes the session expiry sweep on (expires_at, id), without CONCURRENTLY", () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS "session_expires_at_id_idx" ON "session" USING btree \("expires_at","id"\)/,
    );
    expect(migration).not.toMatch(/CREATE INDEX CONCURRENTLY/);
    expect(rollback).toContain('DROP INDEX IF EXISTS "session_expires_at_id_idx"');
  });

  it("declares the sweep index in the schema", () => {
    const config = getTableConfig(session).indexes.find(
      (i) => i.config.name === "session_expires_at_id_idx",
    );
    expect(config?.config.columns.map((c) => (c as { name: string }).name)).toEqual([
      "expires_at",
      "id",
    ]);
  });

  it("has a rollback that drops the index and the column", () => {
    expect(rollback).toContain('DROP INDEX IF EXISTS "oauth_access_token_user_sid_idx"');
    expect(rollback).toContain('DROP COLUMN IF EXISTS "sid"');
  });

  it("matches the schema", () => {
    expect(getTableColumns(oauthAccessToken).sid.notNull).toBe(false);
  });
});
