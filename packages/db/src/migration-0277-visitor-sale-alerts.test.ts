import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0277_visitor_sale_alerts.sql");
const rollback = read("0277_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0277 visitor sale alerts", () => {
  it("is journalled after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0277_visitor_sale_alerts");
    expect(at).toBeGreaterThan(0);
    expect(journal.entries[at]?.when).toBeGreaterThan(journal.entries[at - 1]?.when ?? 0);
  });

  it("keeps one row per address with its consent record", () => {
    for (const column of [
      '"email" text NOT NULL',
      '"consent_text" text NOT NULL',
      '"consent_source" text NOT NULL',
      '"requested_at" timestamp with time zone NOT NULL',
      '"confirmed_at" timestamp with time zone',
      '"unsubscribed_at" timestamp with time zone',
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain(
      'UNIQUE INDEX IF NOT EXISTS "visitor_sale_alert_subscriber_email_uid"',
    );
    expect(migration).toContain("CHECK (\"status\" IN ('pending', 'confirmed', 'unsubscribed'))");
  });

  it("is rerunnable and has a rollback", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS");
    expect(rollback).toContain('DROP TABLE IF EXISTS "visitor_sale_alert_subscriber"');
  });
});
