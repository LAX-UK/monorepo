import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0268_watchlist_reminders.sql");
const rollback = read("0268_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

/** The domain's `WATCHED_LOT_REMINDER_KINDS`; a new kind needs a migration too. */
const KINDS = ["sale_start", "day_before_close", "hour_before_close"];

describe("migration 0268 watchlist reminders", () => {
  it("is journal entry 268, after 0267", () => {
    const entry = journal.entries.find((e) => e.tag === "0268_watchlist_reminders");
    const previous = journal.entries.find((e) => e.tag === "0267_dispute_cases");
    expect(entry?.idx).toBe(268);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("allows exactly the reminder kinds the domain offers", () => {
    const list = migration.slice(migration.indexOf('"kind" IN ('));
    const kinds = [...list.slice(0, list.indexOf(")")).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(kinds).toEqual(KINDS);
  });

  it("removes a reminder with its watched lot", () => {
    expect(migration).toMatch(/REFERENCES "public"\."watchlist"\("id"\) ON DELETE cascade/);
  });

  it("allows the reminder notice, and removes it again on rollback", () => {
    const typesIn = (text: string) => {
      const at = text.lastIndexOf("ADD CONSTRAINT notification_type_check");
      return [...text.slice(at).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    };
    const previous = typesIn(read("0263_consignment_messages.sql"));
    expect(typesIn(migration)).toEqual([...previous, "watchlist_reminder"]);
    expect(typesIn(rollback)).toEqual(previous);
    expect(rollback).toContain("DELETE FROM notification WHERE type = 'watchlist_reminder'");
  });

  it("drops the table on rollback", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "watchlist_reminder"');
  });
});
