import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { passkey } from "@auction/identity-db/schema";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0339_sign_in_methods_data.sql");
const rollback = read("0339_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0339 sign-in methods data", () => {
  it("follows 0337 in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0339_sign_in_methods_data");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0337_shop_print_exception");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds: one table, three columns, and a replaced scrub function", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "provider_email" text/);
    expect(migration).toMatch(/"provider_email_hidden" boolean NOT NULL DEFAULT false/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "amr" text\[\] NOT NULL DEFAULT '\{\}'/);
  });

  it("holds the shape Better Auth's passkey plugin expects, plus last_used_at", () => {
    const columns = Object.keys(getTableColumns(passkey));
    expect(columns).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "name",
        "publicKey",
        "credentialId",
        "counter",
        "deviceType",
        "backedUp",
        "transports",
        "aaguid",
        "createdAt",
        "lastUsedAt",
      ]),
    );
    expect(migration).toMatch(
      /"user_id" text NOT NULL REFERENCES "user"\("id"\) ON DELETE CASCADE/,
    );
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credential_id_uidx"/);
  });

  it("limits a person to ten passkeys in the database, counting under a per-person lock", () => {
    expect(migration).toMatch(
      /pg_advisory_xact_lock\(hashtextextended\('passkey:' \|\| NEW\.user_id/,
    );
    expect(migration).toMatch(/>= 10 THEN\s+RAISE EXCEPTION 'passkey_limit'/);
    expect(migration).toMatch(/BEFORE INSERT ON "passkey"/);
    // The limit holds only under READ COMMITTED; the migration says so where it matters.
    expect(migration).toMatch(/relies on READ COMMITTED/);
  });

  it("limits how a session was signed in to the fixed list", () => {
    expect(migration).toMatch(
      /"amr" <@ ARRAY\['password', 'provider', 'passkey', 'link'\]::text\[\]/,
    );
  });

  it("erases passkeys with the person: the scrub deletes them and the account rows", () => {
    expect(migration).toMatch(/DELETE FROM public\."passkey" WHERE user_id = p_user_id/);
    expect(migration).toMatch(/DELETE FROM public\."account" WHERE user_id = p_user_id/);
  });

  it("is undone by removing only what it added and restoring the earlier scrub", () => {
    expect(rollback).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "passkey"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "amr"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "provider_email"/);
    expect(rollback).not.toMatch(/DELETE FROM public\."passkey"/);
  });
});
