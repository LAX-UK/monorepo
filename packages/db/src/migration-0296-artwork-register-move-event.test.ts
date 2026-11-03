import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0296_artwork_register_move_event.sql");
const rollback = read("0296_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0296 artwork register move event", () => {
  it("is journal entry 296, later than the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0296_artwork_register_move_event");
    expect(journal.entries[at]?.idx).toBe(296);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("widens the event type check by the one new type and keeps the existing ones", () => {
    for (const type of [
      "created",
      "offer_moved",
      "zoho_change_applied",
      "conflict_recorded",
      "conflict_resolved",
      "zoho_writeback_recorded",
      "move_confirmed",
    ]) {
      expect(migration).toContain(`'${type}'`);
    }
  });

  it("rolls back to the earlier check, refusing while the new type is in use", () => {
    expect(rollback).toContain("RAISE EXCEPTION");
    const restored = rollback.slice(rollback.lastIndexOf("ADD CONSTRAINT"));
    expect(restored).toContain("'zoho_writeback_recorded'");
    expect(restored).not.toContain("'move_confirmed'");
  });
});
