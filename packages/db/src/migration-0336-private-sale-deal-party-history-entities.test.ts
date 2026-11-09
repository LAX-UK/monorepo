import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { privateSaleDealPartyHistory } from "./schema/private-sale-deal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0336_private_sale_deal_party_history_entities.sql");
const rollback = read("0336_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0336 party history for organisations named on their own", () => {
  it("follows the migration before it in the journal, one day later", () => {
    const index = journal.entries.findIndex(
      (e) => e.tag === "0336_private_sale_deal_party_history_entities",
    );
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0331_shop_framing_catalogue");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only loosens one column, adds a validated check and indexes, and copies organisations in", () => {
    expect(migration).not.toMatch(/\bDROP TABLE\b|\bDROP COLUMN\b|\bDELETE FROM\b|^UPDATE\b/m);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(/ALTER COLUMN "acting_user_id" DROP NOT NULL/);
    expect(migration).toMatch(/VALIDATE CONSTRAINT "private_sale_deal_party_history_who_check"/);
    expect(migration).toMatch(
      /"private_sale_deal_party_history_entity_uidx"[^;]*WHERE "acting_user_id" IS NULL/,
    );
    expect(migration).toMatch(
      /FROM "private_sale_deal_party" p\s+WHERE p\."acting_user_id" IS NULL/,
    );
  });

  it("is mirrored by the table", () => {
    const columns = getTableColumns(privateSaleDealPartyHistory);
    expect(columns.actingUserId.notNull).toBe(false);
    expect(columns.legalEntityId.notNull).toBe(false);
  });

  it("is undone by removing the organisation-only rows past the append-only trigger, then restoring it", () => {
    expect(rollback).toMatch(/DISABLE TRIGGER "private_sale_deal_party_history_append_only"/);
    expect(rollback).toMatch(
      /DELETE FROM "private_sale_deal_party_history" WHERE "acting_user_id" IS NULL/,
    );
    expect(rollback.indexOf("ENABLE TRIGGER")).toBeGreaterThan(rollback.indexOf("DELETE FROM"));
    expect(rollback).toMatch(/ALTER COLUMN "acting_user_id" SET NOT NULL/);
    expect(rollback).not.toMatch(/^(BEGIN|COMMIT);/m);
  });
});
