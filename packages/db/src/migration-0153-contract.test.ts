import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { bidUserProfile } from "./schema/bid-user-profile.js";
import { userCategoryInterest } from "./schema/user-category-interests.js";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0153 contract", () => {
  it("moves buyer-interest ownership before contracting Identity user", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0153_contract_user_identity_only.sql"), "utf8"),
      readFile(resolve(drizzle, "0153_rollback.sql"), "utf8"),
    ]);

    expect(forward).toContain(
      'ADD COLUMN IF NOT EXISTS "category_interests_onboarding_completed_at"',
    );
    expect(forward).toContain('u."category_interests_onboarding_completed_at"');
    expect(forward).toContain('REFERENCES public.bid_user_profile("user_id")');
    expect(forward).toContain('DROP COLUMN IF EXISTS "category_interests_onboarding_completed_at"');

    expect(rollback).toContain(
      'ADD COLUMN IF NOT EXISTS "category_interests_onboarding_completed_at"',
    );
    expect(rollback).toContain('p."category_interests_onboarding_completed_at"');
    expect(rollback).toContain('REFERENCES public."user"("id")');
    expect(rollback).toContain(
      'DROP COLUMN IF EXISTS "category_interests_onboarding_completed_at"',
    );
  });

  it("points the final Drizzle interest owner at the Bid profile", () => {
    const config = getTableConfig(userCategoryInterest);
    const userIdForeignKey = config.foreignKeys.find(({ reference }) =>
      reference().columns.some(({ name }) => name === "user_id"),
    );

    expect(userIdForeignKey).toBeDefined();
    expect(getTableName(userIdForeignKey?.reference().foreignTable as typeof bidUserProfile)).toBe(
      getTableName(bidUserProfile),
    );
  });
});
