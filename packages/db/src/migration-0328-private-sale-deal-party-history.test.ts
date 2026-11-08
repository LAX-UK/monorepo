import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { privateSaleDealPartyHistory } from "./schema/private-sale-deal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0328_private_sale_deal_party_history.sql");
const rollback = read("0328_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0328 private sale deal party history", () => {
  it("follows 0327 in the journal, one day later", () => {
    const index = journal.entries.findIndex(
      (e) => e.tag === "0328_private_sale_deal_party_history",
    );
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0327_legal_entity_client_message");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds a table and copies existing namings in, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bALTER TABLE\b|\bDELETE FROM\b|\bUPDATE\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "private_sale_deal_party_history"/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(/FROM "private_sale_deal_party"/);
    expect(migration).toMatch(/'private_sale_deal\.party_named'/);
  });

  it("keeps the person even when their account is deleted", () => {
    expect(migration).toMatch(/"acting_user_id" text NOT NULL,/);
    expect(migration).not.toMatch(/"acting_user_id"[^,]*REFERENCES/);
    const columns = getTableColumns(privateSaleDealPartyHistory);
    expect(columns.actingUserId.notNull).toBe(true);
    expect(columns.actingUserId.name).toBe("acting_user_id");
  });

  it("is undone by dropping only that table", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "private_sale_deal_party_history"/);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
  });
});
