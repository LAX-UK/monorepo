import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0276_shop_release_alerts.sql");
const rollback = read("0276_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0276 shop release alerts", () => {
  it("is journalled after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0276_shop_release_alerts");
    expect(at).toBeGreaterThan(0);
    expect(journal.entries[at]?.when).toBeGreaterThan(journal.entries[at - 1]?.when ?? 0);
  });

  it("keeps one row per address and one per token", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "shop_release_alert_subscription"');
    expect(migration).toContain('"shop_release_alert_subscription_email_uid"');
    expect(migration).toContain('"shop_release_alert_subscription_unsubscribe_uid"');
    expect(migration).toContain('"shop_release_alert_subscription_confirm_uid"');
  });

  it("keeps status, address and stop time consistent", () => {
    expect(migration).toContain('"shop_release_alert_subscription_status_ck"');
    expect(migration).toContain('"shop_release_alert_subscription_email_ck"');
    expect(migration).toContain('"shop_release_alert_subscription_stopped_ck"');
  });

  it("rolls back by dropping the table", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "shop_release_alert_subscription"');
  });
});
