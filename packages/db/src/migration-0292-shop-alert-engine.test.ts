import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOPICS_BY_PRODUCT } from "@auction/alerts";
import { describe, expect, it } from "vitest";
import { SHOP_COMMERCE_TABLES } from "./migrate-roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0292_shop_alert_engine.sql");
const rollback = read("0292_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const TABLES = ["subscriber", "topic", "match", "digest", "announcement"] as const;

describe("migration 0292 shop alert engine", () => {
  it("comes after 0285 in the journal", () => {
    const entry = journal.entries.find((e) => e.tag === "0292_shop_alert_engine");
    const previous = journal.entries.find((e) => e.tag === "0285_shop_returns_stock");
    expect(entry?.idx).toBe(292);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("creates the five shop_alert tables and rolls them back", () => {
    for (const table of TABLES) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "shop_alert_${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "shop_alert_${table}"`);
    }
  });

  it("enforces the frequency cap and the once-per-item rules in the database", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "shop_alert_digest_cap_uid"\n  ON "shop_alert_digest" ("subscriber_id", "product", "local_date")',
    );
    expect(migration).toContain('"shop_alert_match_item_uid"');
    expect(migration).toContain('"shop_alert_subscriber_product_email_uid"');
    expect(migration).toContain('CHECK ("email" = lower(btrim("email")))');
  });

  it("allows exactly the Shop and lax.art topics of the catalogue", () => {
    const list = [...TOPICS_BY_PRODUCT.shop, ...TOPICS_BY_PRODUCT.art]
      .map((t) => `'${t}'`)
      .join(", ");
    expect(migration.split(`"topic" IN (${list})`)).toHaveLength(3);
    expect(migration).toContain(`CHECK ("product" IN ('shop', 'art'))`);
  });

  it("keeps ids, states and consent records when moving the release list", () => {
    expect(migration).toContain('INSERT INTO "shop_alert_subscriber"');
    expect(migration).toContain('FROM "shop_release_alert_subscription"');
    expect(migration).toContain("ON CONFLICT DO NOTHING");
    expect(migration).not.toMatch(/DROP TABLE[^;]*shop_release_alert_subscription/);
    expect(rollback).not.toMatch(/DROP TABLE[^;]*shop_release_alert_subscription/);
  });

  it("never stores the plain stop token in the new table", () => {
    expect(migration).toContain(
      "encode(sha256(convert_to(\"unsubscribe_token\", 'UTF8')), 'hex'), \"created_at\"",
    );
    expect(migration).not.toMatch(/"unsubscribe_token"[^,]*,\s*"created_at"/);
  });

  it("starts from what is already published, and is rerunnable", () => {
    expect(migration).toContain('INSERT INTO "shop_alert_announcement"');
    expect(migration).toContain("'artwork:' || \"id\"");
    expect(migration).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(migration).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
  });

  it("puts the tables in the Shop role's grants, and nobody else's", () => {
    for (const table of TABLES) {
      expect([...SHOP_COMMERCE_TABLES]).toContain(`shop_alert_${table}`);
    }
  });
});
