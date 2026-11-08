import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { legalEntity } from "./schema/legal-entities.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0327_legal_entity_client_message.sql");
const rollback = read("0327_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0327 legal entity client message", () => {
  it("follows 0326 in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0327_legal_entity_client_message");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0326_private_sale_deal_register_fk");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds one nullable column, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "client_message" text;/);
    expect(migration.match(/ADD COLUMN[^;]*;/g)?.join("")).not.toMatch(/NOT NULL/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("is mirrored by a nullable column on the table", () => {
    const column = getTableColumns(legalEntity).clientMessage;
    expect(column.name).toBe("client_message");
    expect(column.notNull).toBe(false);
  });

  it("is undone by dropping only that column", () => {
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "client_message"/);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
  });
});
