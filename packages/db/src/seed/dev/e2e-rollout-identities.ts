import { randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";

const { Pool } = pg;

export const E2E_ROLLOUT_PASSWORD = "Password123!";

/** Same id as `CAT.paintings` in the legacy demo seed — has active lots. */
const LEGACY_PAINTINGS_CATEGORY_ID = "c1000001-0000-4000-8000-000000000001";

export const E2E_ROLLOUT_IDS = {
  complete: "a2000001-0000-4000-8000-000000000001",
  unapproved: "a2000001-0000-4000-8000-000000000002",
  incomplete: "a2000001-0000-4000-8000-000000000003",
  zeroLot: "a2000001-0000-4000-8000-000000000004",
  workerReplay: "a2000001-0000-4000-8000-000000000005",
  emptyCategory: "c2000001-0000-4000-8000-000000000001",
} as const;

export const E2E_ROLLOUT_EMAILS = {
  complete: "e2e-complete@lax.bid",
  unapproved: "e2e-unapproved@lax.bid",
  incomplete: "e2e-incomplete@lax.bid",
  zeroLot: "e2e-zero-lot@lax.bid",
  workerReplay: "e2e-worker-replay@lax.bid",
} as const;

/** Purpose-specific buyers inserted after the demo wipe so migration 0137 cannot backfill them. */
export async function seedE2eRolloutIdentities(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new Pool(buildPgConnectionConfig(url));
  const db = drizzle(pool, { schema });
  const stamp = new Date();
  const passwordHash = await hashPassword(E2E_ROLLOUT_PASSWORD);
  const completedAt = new Date("2026-01-15T12:00:00.000Z");

  const credentialAccount = (userId: string) => ({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    password: passwordHash,
    createdAt: stamp,
    updatedAt: stamp,
  });

  await db.insert(schema.category).values({
    id: E2E_ROLLOUT_IDS.emptyCategory,
    name: "E2E Empty Interest",
    slug: "e2e-empty-interest",
    archived: false,
    sortOrder: 900,
    createdAt: stamp,
    updatedAt: stamp,
  });

  await db.insert(schema.user).values([
    {
      id: E2E_ROLLOUT_IDS.complete,
      name: "E2E Complete Buyer",
      firstName: "E2E",
      lastName: "Complete",
      email: E2E_ROLLOUT_EMAILS.complete,
      emailVerified: true,
      role: "client",
      staffRole: null,
      signupPersona: "individual",
      kycStatus: "approved",
      kycVerifiedAt: completedAt,
      categoryInterestsOnboardingCompletedAt: completedAt,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: E2E_ROLLOUT_IDS.unapproved,
      name: "E2E Unapproved Buyer",
      firstName: "E2E",
      lastName: "Unapproved",
      email: E2E_ROLLOUT_EMAILS.unapproved,
      emailVerified: true,
      role: "client",
      staffRole: null,
      signupPersona: "individual",
      kycStatus: "unverified",
      categoryInterestsOnboardingCompletedAt: completedAt,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: E2E_ROLLOUT_IDS.incomplete,
      name: "E2E Incomplete Buyer",
      firstName: "E2E",
      lastName: "Incomplete",
      email: E2E_ROLLOUT_EMAILS.incomplete,
      emailVerified: true,
      role: "client",
      staffRole: null,
      signupPersona: "individual",
      kycStatus: "unverified",
      categoryInterestsOnboardingCompletedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: E2E_ROLLOUT_IDS.zeroLot,
      name: "E2E Zero Lot Buyer",
      firstName: "E2E",
      lastName: "ZeroLot",
      email: E2E_ROLLOUT_EMAILS.zeroLot,
      emailVerified: true,
      role: "client",
      staffRole: null,
      signupPersona: "individual",
      kycStatus: "unverified",
      categoryInterestsOnboardingCompletedAt: completedAt,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: E2E_ROLLOUT_IDS.workerReplay,
      name: "E2E Worker Replay",
      firstName: "E2E",
      lastName: "Replay",
      email: E2E_ROLLOUT_EMAILS.workerReplay,
      emailVerified: true,
      role: "client",
      staffRole: null,
      signupPersona: "individual",
      kycStatus: "approved",
      kycVerifiedAt: completedAt,
      categoryInterestsOnboardingCompletedAt: completedAt,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);

  await db
    .insert(schema.account)
    .values([
      credentialAccount(E2E_ROLLOUT_IDS.complete),
      credentialAccount(E2E_ROLLOUT_IDS.unapproved),
      credentialAccount(E2E_ROLLOUT_IDS.incomplete),
      credentialAccount(E2E_ROLLOUT_IDS.zeroLot),
      credentialAccount(E2E_ROLLOUT_IDS.workerReplay),
    ]);

  await db.insert(schema.kycVerification).values([
    {
      userId: E2E_ROLLOUT_IDS.complete,
      providerSessionId: "vs_seed_e2e_complete",
      status: "verified",
      verifiedFirstName: "E2E",
      verifiedLastName: "Complete",
      verifiedDateOfBirth: "1991-03-15",
      verifiedIdNumberLast4: "2001",
      verifiedIdCountry: "GB",
      verifiedIdType: "passport",
      verifiedIdExpiry: "2031-03-15",
      decisionPayload: { seeded: true, outcome: "verified", purpose: "e2e-complete" },
      createdAt: completedAt,
      decisionAt: completedAt,
    },
    {
      userId: E2E_ROLLOUT_IDS.workerReplay,
      providerSessionId: "vs_seed_e2e_worker_replay",
      status: "verified",
      verifiedFirstName: "E2E",
      verifiedLastName: "Replay",
      verifiedDateOfBirth: "1988-11-02",
      verifiedIdNumberLast4: "2005",
      verifiedIdCountry: "GB",
      verifiedIdType: "passport",
      verifiedIdExpiry: "2031-11-02",
      decisionPayload: { seeded: true, outcome: "verified", purpose: "e2e-worker-replay" },
      createdAt: completedAt,
      decisionAt: completedAt,
    },
  ]);

  await db.insert(schema.userCategoryInterest).values([
    {
      userId: E2E_ROLLOUT_IDS.unapproved,
      categoryId: LEGACY_PAINTINGS_CATEGORY_ID,
      sortOrder: 0,
    },
    {
      userId: E2E_ROLLOUT_IDS.zeroLot,
      categoryId: E2E_ROLLOUT_IDS.emptyCategory,
      sortOrder: 0,
    },
  ]);

  console.log("  E2E rollout identities:");
  console.log(`    ${E2E_ROLLOUT_EMAILS.complete}     complete individual (KYC approved)`);
  console.log(`    ${E2E_ROLLOUT_EMAILS.unapproved}   interests done, KYC unverified`);
  console.log(`    ${E2E_ROLLOUT_EMAILS.incomplete}   interests incomplete`);
  console.log(`    ${E2E_ROLLOUT_EMAILS.zeroLot}      interests in empty category`);
  console.log(`    ${E2E_ROLLOUT_EMAILS.workerReplay} approved worker-replay actor`);

  await pool.end();
}
