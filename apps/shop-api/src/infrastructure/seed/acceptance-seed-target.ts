import { type Database, assertSeedTarget, seedTargetEnvFromProcess } from "@auction/db";
import { seedAcceptancePortalFixtures } from "./acceptance-portal-seed.js";
import { seedAcceptanceStaffOperationsFixtures } from "./acceptance-staff-operations-seed.js";

/**
 * The acceptance seeds grant Shop staff roles and sale authority, so they go through the same
 * guard as every other seed: no production environment or address, and the database must carry
 * the demo seed mark (migration 0398). There is no override.
 */
export async function assertAcceptanceSeedTarget(
  db: Database,
  seed: string,
  databaseUrl: string,
  source: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await assertSeedTarget(db, seed, {
    ...seedTargetEnvFromProcess("DATABASE_URL_SHOP", source),
    databaseUrl,
  });
}

/** What `seed:acceptance-portal` runs: the guard, then the fixtures. */
export async function seedAcceptancePortal(
  db: Database,
  databaseUrl: string,
  grantSaleAuthority: Parameters<typeof seedAcceptancePortalFixtures>[1],
  options: Parameters<typeof seedAcceptancePortalFixtures>[2],
  source: NodeJS.ProcessEnv = process.env,
  seed: typeof seedAcceptancePortalFixtures = seedAcceptancePortalFixtures,
): Promise<void> {
  await assertAcceptanceSeedTarget(db, "shop acceptance portal", databaseUrl, source);
  await seed(db, grantSaleAuthority, options);
}

/** What `seed:acceptance-staff-operations` runs: the guard, then the fixtures. */
export async function seedAcceptanceStaffOperations(
  db: Database,
  databaseUrl: string,
  options: Parameters<typeof seedAcceptanceStaffOperationsFixtures>[1],
  source: NodeJS.ProcessEnv = process.env,
  seed: typeof seedAcceptanceStaffOperationsFixtures = seedAcceptanceStaffOperationsFixtures,
): ReturnType<typeof seedAcceptanceStaffOperationsFixtures> {
  await assertAcceptanceSeedTarget(db, "shop acceptance staff operations", databaseUrl, source);
  return seed(db, options);
}
