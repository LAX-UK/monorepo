import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0249_bid_fulfilment_notices.sql");
const rollback = read("0249_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const NEW_TYPES = ["lot_ready_for_collection", "lot_shipped", "lot_delivered"];

function typesIn(text: string): string[] {
  const list = text.slice(text.lastIndexOf("IN ("));
  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

describe("migration 0249 bid fulfilment notices", () => {
  it("is journal entry 249", () => {
    expect(journal.entries.find((e) => e.tag === "0249_bid_fulfilment_notices")?.idx).toBe(249);
  });

  it("allows the three fulfilment types and keeps every other type", () => {
    const types = typesIn(migration);
    for (const type of NEW_TYPES) expect(types).toContain(type);
    for (const type of typesIn(rollback)) expect(types).toContain(type);
    expect(types).toContain("staff_role_changed_admin");
  });

  it("removes the new notices and the new types on rollback", () => {
    for (const type of NEW_TYPES) {
      expect(typesIn(rollback)).not.toContain(type);
      expect(rollback).toContain(`'${type}'`);
    }
    expect(rollback).toMatch(/DELETE FROM notification WHERE type IN \(/);
  });
});
