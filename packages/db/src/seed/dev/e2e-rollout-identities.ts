import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";

const { Pool } = pg;

export const E2E_ROLLOUT_PASSWORD = "Password123!";

/** Legacy demo users — mutated in place so admin client visuals keep a 17-row directory. */
export const E2E_ROLLOUT_IDS = {
  complete: "90000000-0000-4000-8000-000000000003",
  unapproved: "90000000-0000-4000-8000-000000000008",
  incomplete: "90000000-0000-4000-8000-000000000018",
  zeroLot: "90000000-0000-4000-8000-000000000006",
} as const;

export const E2E_ROLLOUT_EMAILS = {
  complete: "user1@lax.bid",
  unapproved: "gallery-finance@lax.bid",
  incomplete: "viewer@lax.bid",
  zeroLot: "apple-test@lax.bid",
} as const;

/** Same id as `CAT.paintings` in the legacy demo seed — has active lots. */
const LEGACY_PAINTINGS_CATEGORY_ID = "c1000001-0000-4000-8000-000000000001";

/** Purpose flags on existing buyers. Inserting extra users changes admin client counts. */
export async function seedE2eRolloutIdentities(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new Pool(buildPgConnectionConfig(url));
  const db = drizzle(pool, { schema });
  const stamp = new Date();
  const completedAt = new Date("2026-01-15T12:00:00.000Z");

  await db
    .update(schema.user)
    .set({
      categoryInterestsOnboardingCompletedAt: completedAt,
      updatedAt: stamp,
    })
    .where(eq(schema.user.id, E2E_ROLLOUT_IDS.complete));

  await db
    .update(schema.user)
    .set({
      categoryInterestsOnboardingCompletedAt: completedAt,
      updatedAt: stamp,
    })
    .where(eq(schema.user.id, E2E_ROLLOUT_IDS.unapproved));

  // Keep signupPersona unset so the admin clients snapshot stays "Not set".
  // Login resume still requires individual + FULL_BUYER_ONBOARDING_ENABLED.
  await db
    .update(schema.user)
    .set({
      categoryInterestsOnboardingCompletedAt: null,
      updatedAt: stamp,
    })
    .where(eq(schema.user.id, E2E_ROLLOUT_IDS.incomplete));

  await db
    .update(schema.user)
    .set({
      categoryInterestsOnboardingCompletedAt: completedAt,
      updatedAt: stamp,
    })
    .where(eq(schema.user.id, E2E_ROLLOUT_IDS.zeroLot));

  await db.insert(schema.userCategoryInterest).values({
    userId: E2E_ROLLOUT_IDS.unapproved,
    categoryId: LEGACY_PAINTINGS_CATEGORY_ID,
    sortOrder: 0,
  });

  console.log("  E2E rollout identities (existing users):");
  console.log(`    ${E2E_ROLLOUT_EMAILS.complete}        interests done, KYC approved`);
  console.log(`    ${E2E_ROLLOUT_EMAILS.unapproved} interests done, KYC unverified`);
  console.log(`    ${E2E_ROLLOUT_EMAILS.incomplete}         interests incomplete`);
  console.log(`    ${E2E_ROLLOUT_EMAILS.zeroLot}      interests done, empty selection`);

  await pool.end();
}
