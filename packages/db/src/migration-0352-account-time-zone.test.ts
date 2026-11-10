import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  API_READ_TABLES,
  AUTH_FULL_TABLES,
  WORKER_PRODUCT_PROFILE_TABLES,
} from "./migrate-roles.js";
import { user } from "./schema/auth.js";
import { bidIdentityDirectory } from "./schema/bid-identity-directory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0352_account_time_zone.sql");
const rollback = read("0352_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0352 account time zone", () => {
  it("is journalled as entry 346, right after 0351, with a later timestamp", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0352_account_time_zone");
    expect(journal.entries[index]?.idx).toBe(346);
    expect(journal.entries[index]?.when).toBe(1805443200000);
    expect(journal.entries[index - 1]?.tag).toBe("0351_payment_checkout_session_parameters");
    expect(journal.entries[index]?.when).toBeGreaterThan(journal.entries[index - 1]?.when ?? 0);
    expect(index).toBe(journal.entries.length - 1);
  });

  it("adds the columns idempotently and never drops data", () => {
    expect(migration).not.toMatch(/\bDROP COLUMN\b|\bDELETE\b|\bTRUNCATE\b/);
    for (const table of ["user", "bid_identity_directory"]) {
      expect(migration).toContain(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "time_zone_mode"`,
      );
      expect(migration).toContain(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "time_zone" text`,
      );
    }
  });

  it("keeps a zone to a real place and a fixed choice to a zone, as named constraints", () => {
    for (const name of [
      "user_time_zone_mode_valid",
      "user_time_zone_names_a_place",
      "user_fixed_time_zone_present",
    ]) {
      expect(migration).toContain(`DROP CONSTRAINT IF EXISTS "${name}"`);
      expect(migration).toContain(`ADD CONSTRAINT "${name}"`);
      expect(rollback).toContain(`DROP CONSTRAINT IF EXISTS "${name}"`);
    }
    expect(migration).toContain("NOT LIKE 'Etc/%'");
  });

  it("backfills only people who chose quiet hours, and leaves quiet_time_zone in place", () => {
    expect(migration).toContain('np."quiet_start" IS NOT NULL');
    expect(migration).toContain('np."quiet_end" IS NOT NULL');
    expect(migration).toContain(`np."quiet_time_zone" NOT LIKE 'Etc/%'`);
    expect(migration).toContain(`"time_zone_mode" = 'fixed'`);
    expect(migration).not.toContain("DROP COLUMN");
    expect(rollback).not.toMatch(/ALTER TABLE "notification_preference"/);
  });

  it("copies the backfill to the Bid directory", () => {
    expect(migration).toMatch(/UPDATE "bid_identity_directory" AS d\s+SET "time_zone_mode"/);
  });

  it("has a rollback that drops every column it added", () => {
    for (const table of ["user", "bid_identity_directory"]) {
      for (const column of ["time_zone", "time_zone_mode"]) {
        expect(rollback).toContain(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`);
      }
    }
  });

  it("matches the schema", () => {
    const userColumns = getTableColumns(user);
    expect(userColumns.timeZoneMode.notNull).toBe(true);
    expect(userColumns.timeZoneMode.default).toBe("automatic");
    expect(userColumns.timeZone.notNull).toBe(false);
    const directory = getTableColumns(bidIdentityDirectory);
    expect(directory.timeZoneMode.notNull).toBe(true);
    expect(directory.timeZone.notNull).toBe(false);
  });

  it("needs no new grant: every role that reads or writes these columns has the whole table", () => {
    // Identity writes "user"; the worker projector writes the directory and the Bid API reads it.
    expect(AUTH_FULL_TABLES).toContain("user");
    expect(WORKER_PRODUCT_PROFILE_TABLES).toContain("bid_identity_directory");
    expect(API_READ_TABLES).toContain("bid_identity_directory");
  });
});
