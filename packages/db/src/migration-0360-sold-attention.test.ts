import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0360_artwork_register_sold_attention.sql");
const rollback = read("0360_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0360 sold-while-live attention", () => {
  it("is journalled after the entry before it, with a fixed stamp", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0360_artwork_register_sold_attention");
    const entry = journal.entries[at];
    const previous = journal.entries[at - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe(1807084800000);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    const next = journal.entries[at + 1];
    if (next) expect(next.when).toBeGreaterThan(entry?.when ?? 0);
  });

  it("allows one live item per artwork and Zoho status", () => {
    expect(migration).toContain('("register_id", "zoho_status")');
    expect(migration).toContain(`WHERE "status" IN ('open', 'overridden')`);
  });

  it("widens the history check with the three new events and rolls back to the old list", () => {
    for (const type of [
      "sold_while_live_raised",
      "sold_while_live_resolved",
      "sold_while_live_overridden",
    ]) {
      expect(migration).toContain(`'${type}'`);
      expect(rollback).not.toContain(`'${type}'`);
    }
    expect(rollback).toContain("DROP TABLE IF EXISTS");
  });
});
