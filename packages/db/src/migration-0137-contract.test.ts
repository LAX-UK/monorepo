import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { userCategoryInterest } from "./schema/user-category-interests.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const forward = readFileSync(
  join(__dirname, "../drizzle/0137_user_category_interests.sql"),
  "utf8",
);
const rollback = readFileSync(join(__dirname, "../drizzle/0137_rollback.sql"), "utf8");

describe("migration 0137 user category interests contract", () => {
  it("backfills existing users complete while leaving the new-user marker without a default", () => {
    expect(forward).toContain(
      'ADD COLUMN IF NOT EXISTS "category_interests_onboarding_completed_at" timestamptz',
    );
    expect(forward).toContain(
      'SET "category_interests_onboarding_completed_at" = now()\nWHERE "category_interests_onboarding_completed_at" IS NULL',
    );
    expect(forward).toContain('AND "created_at" < transaction_timestamp()');
    expect(forward).not.toMatch(
      /category_interests_onboarding_completed_at"\s+timestamptz\s+(?:NOT NULL\s+)?DEFAULT/i,
    );
  });

  it("normalizes ordered user interests with ownership and category constraints", () => {
    expect(forward).toContain('"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE');
    expect(forward).toContain(
      '"category_id" uuid NOT NULL REFERENCES "category"("id") ON DELETE RESTRICT',
    );
    expect(forward).toContain('PRIMARY KEY ("user_id", "category_id")');
    expect(forward).toContain('ON "user_category_interest" ("user_id", "sort_order")');
  });

  it("rolls back the dependent table before the user marker", () => {
    expect(rollback.indexOf('DROP TABLE IF EXISTS "user_category_interest"')).toBeLessThan(
      rollback.indexOf('DROP COLUMN IF EXISTS "category_interests_onboarding_completed_at"'),
    );
  });

  it("keeps the Drizzle schema aligned with the migrated table contract", () => {
    const config = getTableConfig(userCategoryInterest);
    expect(config.name).toBe("user_category_interest");
    expect(config.columns.map(({ name }) => name)).toEqual([
      "user_id",
      "category_id",
      "sort_order",
      "created_at",
    ]);
    expect(config.primaryKeys).toHaveLength(1);
    expect(config.indexes.map(({ config: index }) => index.name)).toEqual(
      expect.arrayContaining([
        "user_category_interest_category_id_idx",
        "user_category_interest_user_sort_idx",
      ]),
    );
    expect(config.foreignKeys).toHaveLength(2);
  });
});
