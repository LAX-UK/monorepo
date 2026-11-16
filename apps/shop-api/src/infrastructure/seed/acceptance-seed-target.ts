import { type Database, assertSeedTarget, seedTargetEnvFromProcess } from "@auction/db";

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
