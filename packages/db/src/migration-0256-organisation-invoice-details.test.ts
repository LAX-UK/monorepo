import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0256_organisation_invoice_details.sql");
const rollback = read("0256_rollback.sql");
const previous = read("0249_bid_fulfilment_notices.sql");
const schema = readFileSync(join(__dirname, "schema/notifications.ts"), "utf8");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const NEW_TYPES = ["organisation_member_left", "payout_bank_changed"];

function typesIn(text: string): string[] {
  const list = text.slice(text.lastIndexOf("IN ("));
  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

describe("migration 0256 organisation invoice details", () => {
  it("is journal entry 256, after 0254", () => {
    const entry = journal.entries.find((e) => e.tag === "0256_organisation_invoice_details");
    expect(entry?.idx).toBe(256);
    expect(entry?.when).toBeGreaterThan(1797321600000);
  });

  it("creates the invoice details table with an all-or-nothing address", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "legal_entity_invoice_details"');
    expect(migration).toContain("legal_entity_invoice_details_address_complete");
    expect(rollback).toContain('DROP TABLE IF EXISTS "legal_entity_invoice_details"');
  });

  it("adds the two notices, keeps every earlier type and matches the schema", () => {
    const types = typesIn(migration);
    for (const type of [...typesIn(previous), ...NEW_TYPES]) expect(types).toContain(type);
    const declared = typesIn(
      schema
        .slice(schema.indexOf("notification_type_check"))
        .replace("${table.type} IN (", "type IN ("),
    );
    expect(new Set(types)).toEqual(new Set(declared));
  });

  it("removes the notices and their types on rollback", () => {
    for (const type of NEW_TYPES) expect(typesIn(rollback)).not.toContain(type);
    expect(rollback).toMatch(/DELETE FROM notification WHERE type IN \(/);
    expect(new Set(typesIn(rollback))).toEqual(new Set(typesIn(previous)));
  });
});
