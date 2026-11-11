import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOPICS_BY_PRODUCT } from "@auction/alerts";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0284_alert_engine.sql");
const rollback = read("0284_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0284 alert engine", () => {
  it("is journal entry 284, after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0284_alert_engine");
    expect(journal.entries[at]?.idx).toBe(284);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("creates the five bid_alert tables", () => {
    for (const table of ["subscriber", "topic", "match", "digest", "announcement"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "bid_alert_${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "bid_alert_${table}"`);
    }
  });

  it("enforces the frequency cap and the once-per-item rules in the database", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "bid_alert_digest_cap_uid"\n  ON "bid_alert_digest" ("subscriber_id", "product", "local_date")',
    );
    expect(migration).toContain('"bid_alert_match_item_uid"');
    expect(migration).toContain('"bid_alert_subscriber_product_email_uid"');
    expect(migration).toContain('CHECK ("email" = lower(btrim("email")))');
  });

  it("allows exactly the Bid topics of the catalogue", () => {
    const list = TOPICS_BY_PRODUCT.bid.map((t) => `'${t}'`).join(", ");
    expect(migration).toContain(`CHECK ("topic" IN (${list}))`);
  });

  it("keeps ids, states and consent records when moving the visitor list", () => {
    expect(migration).toContain('INSERT INTO "bid_alert_subscriber"');
    expect(migration).toContain('FROM "visitor_sale_alert_subscriber"');
    expect(migration).toContain("ON CONFLICT DO NOTHING");
    expect(migration).not.toMatch(/DROP TABLE[^;]*visitor_sale_alert_subscriber/);
    expect(rollback).not.toMatch(/visitor_sale_alert_subscriber"/);
  });

  it("adds the notice type and the preference column, and rolls them back", () => {
    expect(migration).toContain("'sale_announced'");
    expect(migration).toContain('"new_sales_in_app" boolean DEFAULT true NOT NULL');
    expect(rollback).not.toContain("'sale_announced',");
    expect(rollback).toContain("DELETE FROM notification WHERE type = 'sale_announced'");
    expect(rollback).toContain("DROP COLUMN IF EXISTS new_sales_in_app");
  });

  it("lists every notification type on main plus sale_announced, and rolls back to main's list", () => {
    const typesIn = (sql: string) => {
      const at = sql.lastIndexOf("ADD CONSTRAINT notification_type_check");
      const list = sql.slice(at, sql.indexOf(")", sql.indexOf("IN (", at)));
      return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    };
    // Types added by later migrations are not part of what 0284 allowed.
    const asOf0284 = NOTIFICATION_TYPES.filter(
      (t) =>
        ![
          "artist_lots_listed",
          "search_lots_listed",
          "reoffer_seller_request",
          "reoffer_seller_reminder",
          "reoffer_seller_outcome",
          "reoffer_offer",
          "reoffer_offer_reminder",
          "reoffer_offer_closed",
        ].includes(t),
    );
    expect(typesIn(migration)).toEqual(asOf0284);
    expect(typesIn(rollback)).toEqual(asOf0284.filter((t) => t !== "sale_announced"));
    for (const type of [
      "kyc_approved",
      "kyc_declined",
      "sale_cancelled",
      "payment_reminder",
      "buyer_default_notice",
    ]) {
      expect(typesIn(migration)).toContain(type);
      expect(typesIn(rollback)).toContain(type);
    }
  });

  it("is rerunnable", () => {
    expect(migration).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(migration).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
  });
});
