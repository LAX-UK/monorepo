import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { consignmentAgreement } from "./schema/consignment-agreements.js";
import { itemSubmission } from "./schema/item-submissions.js";
import { unsoldLotChoice } from "./schema/unsold-lot-choices.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  join(__dirname, "../drizzle/0239_consignment_after_sale.sql"),
  "utf8",
);
const rollback = readFileSync(join(__dirname, "../drizzle/0239_rollback.sql"), "utf8");
const journal = JSON.parse(
  readFileSync(join(__dirname, "../drizzle/meta/_journal.json"), "utf8"),
) as { entries: { tag: string; when: number }[] };

describe("migration 0239 consignment after sale contract", () => {
  it("is additive and idempotent", () => {
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "unsold_lot_choice"/);
    expect(migration.match(/EXCEPTION WHEN duplicate_object THEN NULL/g)).toHaveLength(5);
  });

  it("creates every column the Drizzle schema declares for unsold choices", () => {
    for (const column of Object.values(getTableColumns(unsoldLotChoice))) {
      expect(migration, column.name).toContain(`"${column.name}"`);
    }
  });

  it("adds only declared columns, and the rollback drops each and the table", () => {
    const added = [...migration.matchAll(/ADD COLUMN IF NOT EXISTS "(\w+)"/g)].map((m) => m[1]);
    expect(added).toEqual(["relist_reserve_floor", "identity_reminder_sent_at"]);
    const declared = [
      ...Object.values(getTableColumns(consignmentAgreement)),
      ...Object.values(getTableColumns(itemSubmission)),
    ].map((c) => c.name);
    for (const column of added) {
      expect(declared, column).toContain(column);
      expect(rollback, column).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
    expect(rollback).toContain('DROP TABLE IF EXISTS "unsold_lot_choice"');
  });

  it("allows consignment updates in notifications and removes them on rollback", () => {
    expect(migration).toContain("'consignment_update'");
    expect(rollback).toContain("DELETE FROM notification WHERE type = 'consignment_update'");
    expect(rollback).not.toContain("'consignment_update',");
  });

  it("keeps one choice per unsold outcome of a lot", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "unsold_lot_choice_outcome_uidx" ON "unsold_lot_choice" USING btree \("lot_id", "lot_end_time"\)/,
    );
  });

  it("follows 0238 in the journal with a later stamp", () => {
    const entries = journal.entries;
    const at = entries.findIndex((e) => e.tag === "0239_consignment_after_sale");
    expect(entries[at - 1]?.tag).toBe("0238_submission_submitted_by");
    expect(entries[at]?.when).toBe(1796025600000);
    expect(entries[at]?.when).toBeGreaterThan(entries[at - 1]?.when ?? Number.POSITIVE_INFINITY);
  });
});
