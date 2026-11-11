import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { WORKER_REOFFER_TABLES, WORKER_REOFFER_UPDATE_COLUMNS } from "./migrate-roles.js";
import { buyerDefault } from "./schema/buyer-default.js";
import { lotReoffer, sellerConsent } from "./schema/lot-reoffer.js";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0354_lot_reoffer.sql");
const rollback = read("0354_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const REOFFER_NOTICES = [
  "reoffer_seller_request",
  "reoffer_seller_reminder",
  "reoffer_seller_outcome",
  "reoffer_offer",
  "reoffer_offer_reminder",
  "reoffer_offer_closed",
];

describe("migration 0354 lot re-offer", () => {
  it("is journalled as entry 348 with a later time than the entry before it", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0354_lot_reoffer");
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe(348);
    expect(entry?.when).toBe(1805616000000);
    // Entries 346 and 347 belong to migrations still open in other branches; the gap is expected.
    expect(entry?.idx).toBeGreaterThan(previous?.idx ?? 0);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
    expect(journal.entries.at(-1)?.tag).toBe("0354_lot_reoffer");
  });

  it("creates both tables and every index and check idempotently, with a lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout/);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "seller_consent"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "lot_reoffer"');
    expect(migration).not.toMatch(
      /\bDROP (TABLE|COLUMN)\b|\bUPDATE "|\bDELETE FROM\b|\bINSERT INTO\b/,
    );
    for (const table of [sellerConsent, lotReoffer]) {
      const config = getTableConfig(table);
      for (const index of config.indexes) {
        expect(migration, index.config.name).toContain(`"${index.config.name}"`);
      }
      for (const check of config.checks) {
        expect(migration, check.name).toContain(`"${check.name}"`);
      }
    }
  });

  it("is mirrored by the Drizzle tables, column for column", () => {
    for (const [table, name] of [
      [sellerConsent, "seller_consent"],
      [lotReoffer, "lot_reoffer"],
    ] as const) {
      expect(getTableName(table)).toBe(name);
      for (const column of Object.values(getTableColumns(table))) {
        expect(migration, `${name}.${column.name}`).toContain(`"${column.name}"`);
      }
    }
  });

  it("keeps one open offer per lot and a sequence of 1 to 3", () => {
    expect(migration).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS "lot_reoffer_one_open_per_lot_uidx"\n  ON "lot_reoffer" ("lot_id") WHERE "status" IN ('awaiting_seller', 'ready', 'offered')`,
    );
    expect(migration).toContain(`CHECK ("sequence" BETWEEN 1 AND 3)`);
    expect(migration).toContain('"lot_reoffer_default_sequence_uidx"');
  });

  it("allows the six re-offer notices, and the schema lists them", () => {
    for (const type of REOFFER_NOTICES) {
      expect(migration).toContain(`'${type}'`);
      expect(NOTIFICATION_TYPES).toContain(type);
    }
  });

  it("leaves the buyer default's retired offer columns in place", () => {
    expect(getTableColumns(buyerDefault).offeredUserId.name).toBe("offered_user_id");
    expect(getTableColumns(buyerDefault).offeredAmount.name).toBe("offered_amount");
    expect(migration).not.toMatch(/ALTER TABLE "?buyer_default"?/);
  });

  it("has a rollback that drops both tables, the notices and restores the earlier constraint", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "lot_reoffer"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "seller_consent"');
    for (const type of REOFFER_NOTICES) expect(rollback).toContain(`'${type}'`);
    const restored = rollback.slice(rollback.indexOf("ADD CONSTRAINT notification_type_check"));
    for (const type of REOFFER_NOTICES) expect(restored).not.toContain(`'${type}'`);
    expect(restored).toContain("'search_lots_listed'");
  });

  it("gives the worker no more than the sweeps need on the two tables", () => {
    expect([...WORKER_REOFFER_TABLES]).toEqual(["lot_reoffer", "seller_consent"]);
    // Never the column that makes a lot's winner, the price, or who the offer is for.
    expect([...WORKER_REOFFER_UPDATE_COLUMNS.lot_reoffer]).not.toContain("reawarded_at");
    for (const column of ["amount_pence", "offered_user_id", "source_bid_id", "lot_id"]) {
      expect([...WORKER_REOFFER_UPDATE_COLUMNS.lot_reoffer]).not.toContain(column);
    }
    const known = Object.values(getTableColumns(lotReoffer)).map((c) => c.name);
    for (const column of WORKER_REOFFER_UPDATE_COLUMNS.lot_reoffer) expect(known).toContain(column);
    // A lapse is written as an answer, so it needs the answer columns; the request itself stays fixed.
    const consentColumns = Object.values(getTableColumns(sellerConsent)).map((c) => c.name);
    for (const column of WORKER_REOFFER_UPDATE_COLUMNS.seller_consent) {
      expect(consentColumns).toContain(column);
    }
    expect([...WORKER_REOFFER_UPDATE_COLUMNS.seller_consent].sort()).toEqual([
      "answered_at",
      "answered_by_user_id",
      "channel",
      "note",
      "preferred_next",
      "reminded_at",
      "status",
    ]);
    for (const column of ["terms_snapshot", "due_at", "seller_legal_entity_id", "subject_id"]) {
      expect([...WORKER_REOFFER_UPDATE_COLUMNS.seller_consent]).not.toContain(column);
    }
  });

  it("records when the offer re-awarded the lot, only for an accepted offer", () => {
    expect(getTableColumns(lotReoffer).reawardedAt.name).toBe("reawarded_at");
    expect(migration).toContain('"reawarded_at" timestamp with time zone');
    expect(migration).toContain(
      `CHECK ("reawarded_at" IS NULL OR ("status" = 'accepted' AND "responded_at" IS NOT NULL))`,
    );
    // The rollback drops the table, and with it the column and its check.
    expect(rollback).toContain('DROP TABLE IF EXISTS "lot_reoffer"');
  });
});
