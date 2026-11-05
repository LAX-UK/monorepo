import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHOP_COMMERCE_TABLES } from "./migrate-roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0309_drop_shop_release_alert_subscription.sql");
const rollback = read("0309_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0309 drop the old Shop release list", () => {
  it("is journalled after the engine move", () => {
    const entry = journal.entries.find(
      (e) => e.tag === "0309_drop_shop_release_alert_subscription",
    );
    const move = journal.entries.find((e) => e.tag === "0292_shop_alert_engine");
    expect(entry?.idx).toBe(304);
    expect(entry?.when).toBeGreaterThan(move?.when ?? Number.POSITIVE_INFINITY);
  });

  it("drops only the old table", () => {
    expect(migration).toContain('DROP TABLE IF EXISTS "shop_release_alert_subscription"');
    const statements = migration.replace(/^--.*$/gm, "");
    expect(statements).not.toContain("shop_alert_");
  });

  it("rolls back by recreating the table and refilling it from the engine's subscribers", () => {
    expect(rollback).toContain('CREATE TABLE IF NOT EXISTS "shop_release_alert_subscription"');
    expect(rollback).toContain('FROM "shop_alert_subscriber"');
    expect(rollback).toContain(`WHERE s."product" = 'shop'`);
  });

  it("no longer grants the dropped table to the Shop role", () => {
    expect(SHOP_COMMERCE_TABLES).not.toContain("shop_release_alert_subscription");
  });
});
