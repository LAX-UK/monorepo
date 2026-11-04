import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { crmRecordLink } from "./schema/crm-record-link.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0310_crm_held_deal_payload.sql");
const rollback = read("0310_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0310 crm held deal payload", () => {
  it("is journalled as entry 310", () => {
    const entry = journal.entries.find((e) => e.tag === "0310_crm_held_deal_payload");
    expect(entry?.idx).toBe(310);
    expect(entry?.when).toBe(1802332800000);
  });

  it("only adds one nullable column, idempotently", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration).toMatch(
      /ALTER TABLE "crm_record_link" ADD COLUMN IF NOT EXISTS "held_payload" jsonb;/,
    );
    expect(migration).not.toMatch(/NOT NULL/);
  });

  it("has a rollback that drops the column", () => {
    expect(rollback).toMatch(/ALTER TABLE "crm_record_link" DROP COLUMN IF EXISTS "held_payload";/);
  });

  it("matches the schema", () => {
    expect(getTableColumns(crmRecordLink).heldPayload.name).toBe("held_payload");
    expect(getTableColumns(crmRecordLink).heldPayload.notNull).toBe(false);
  });
});
