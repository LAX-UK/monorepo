import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bidUserProfile } from "./schema/bid-user-profile.js";
import { legalEntity } from "./schema/legal-entities.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0320_pay_held_since.sql");
const rollback = read("0320_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0320 pay held since", () => {
  it("is the last journal entry, one day after the entry before it", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0320_pay_held_since");
    expect(index).toBe(journal.entries.length - 1);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds two nullable columns, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS "pay_held_since" timestamp with time zone;/,
    );
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS "identity_held_since" timestamp with time zone;/,
    );
    expect(migration.match(/ADD COLUMN[^;]*;/g)?.join("")).not.toMatch(/NOT NULL/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("backfills only organisations that cannot pay today, from their last status change", () => {
    const update = migration.slice(migration.indexOf('UPDATE "legal_entity"'));
    expect(update).toMatch(/SET "pay_held_since" = "status_changed_at"/);
    expect(update).toMatch(/"kind" = 'organisation'/);
    expect(update).toMatch(/"pay_held_since" IS NULL/);
    for (const status of ["lead", "docs_requested", "docs_received", "under_review"]) {
      expect(update).toContain(`'${status}'`);
    }
    // Statuses that allow paying are never held.
    for (const status of ["approved", "connect_pending", "restricted"]) {
      expect(update).not.toContain(`'${status}'`);
    }
  });

  it("has a rollback that drops both columns", () => {
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "identity_held_since"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "pay_held_since"/);
  });

  it("matches the schema", () => {
    expect(getTableColumns(legalEntity).payHeldSince.notNull).toBe(false);
    expect(getTableColumns(bidUserProfile).identityHeldSince.notNull).toBe(false);
  });
});
