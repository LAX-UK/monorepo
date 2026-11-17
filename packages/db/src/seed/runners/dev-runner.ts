import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildPgPoolConfig } from "../../ssl.js";
import { seedDevTwoFactorPolicy } from "../dev/dev-two-factor-policy.js";
import { seedE2eRolloutIdentities } from "../dev/e2e-rollout-identities.js";
import { runLegacyDemoSeed } from "../dev/legacy-demo-seed.js";
import {
  type SeedTargetEnv,
  assertSeedEnvironment,
  seedTargetEnvFromProcess,
  withSeedTarget,
} from "../shared/seed-target-guard.js";

const SEED = "dev seed";

type Queryable = Parameters<typeof withSeedTarget>[0];

/** The dev seed's writes, injectable so the guard, the order and the refusals are tested without a database. */
export type DevSeedSteps = {
  loadDemoData(password: string, hermetic: boolean): Promise<void>;
  flagRolloutIdentities(): Promise<void>;
  relaxStaffTwoFactor(): Promise<void>;
  log(message: string): void;
};

/**
 * Checks the target (the demo seed mark) and the password before anything is written, then loads
 * the demo data. Staff two-factor is made optional only on a hermetic database; on any other
 * target the policy is left as it is.
 */
export async function runDevSeedSteps(
  db: Queryable,
  env: SeedTargetEnv,
  steps: DevSeedSteps,
): Promise<void> {
  await withSeedTarget(db, SEED, env, async (password, target) => {
    await steps.loadDemoData(password, target.hermetic);
    await steps.flagRolloutIdentities();
    if (target.hermetic) {
      await steps.relaxStaffTwoFactor();
    } else {
      steps.log(
        `[seed] staff two-factor policy left as it is: this is a ${target.environment} database, not a hermetic local one`,
      );
    }
  });
}

export async function runDevSeed(): Promise<void> {
  const env = seedTargetEnvFromProcess();
  const url = assertSeedEnvironment(SEED, env);
  const pool = new pg.Pool(buildPgPoolConfig(url));
  try {
    await runDevSeedSteps(drizzle(pool), env, {
      loadDemoData: (password, hermetic) => runLegacyDemoSeed({ password, hermetic }),
      flagRolloutIdentities: () => seedE2eRolloutIdentities(),
      relaxStaffTwoFactor: () => seedDevTwoFactorPolicy(),
      log: (message) => console.log(message),
    });
  } finally {
    await pool.end();
  }
}
