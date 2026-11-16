import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildPgPoolConfig } from "../../ssl.js";
import { seedDevTwoFactorPolicy } from "../dev/dev-two-factor-policy.js";
import { seedE2eRolloutIdentities } from "../dev/e2e-rollout-identities.js";
import { runLegacyDemoSeed } from "../dev/legacy-demo-seed.js";
import {
  type SeedTarget,
  type SeedTargetEnv,
  assertSeedEnvironment,
  assertSeedTarget,
  seedAccountPassword,
  seedTargetEnvFromProcess,
} from "../shared/seed-target-guard.js";

const SEED = "dev seed";

/** The dev seed's steps, injectable so the order and the refusals are tested without a database. */
export type DevSeedSteps = {
  assertTarget(): Promise<SeedTarget>;
  loadDemoData(password: string): Promise<void>;
  flagRolloutIdentities(): Promise<void>;
  relaxStaffTwoFactor(): Promise<void>;
  log(message: string): void;
};

/**
 * Checks the target before anything is written, then loads the demo data. Staff two-factor is
 * made optional only on a hermetic database; on any other target the policy is left as it is.
 */
export async function runDevSeedSteps(
  steps: DevSeedSteps,
  env: Pick<SeedTargetEnv, "seedAccountPassword">,
): Promise<void> {
  const target = await steps.assertTarget();
  const password = seedAccountPassword(target, env, SEED);
  await steps.loadDemoData(password);
  await steps.flagRolloutIdentities();
  if (target.hermetic) {
    await steps.relaxStaffTwoFactor();
  } else {
    steps.log(
      `[seed] staff two-factor policy left as it is: this is a ${target.environment} database, not a local one`,
    );
  }
}

export async function runDevSeed(): Promise<void> {
  const env = seedTargetEnvFromProcess();
  const url = assertSeedEnvironment(SEED, env);
  const pool = new pg.Pool(buildPgPoolConfig(url));
  try {
    const db = drizzle(pool);
    await runDevSeedSteps(
      {
        assertTarget: () => assertSeedTarget(db, SEED, env),
        loadDemoData: (password) => runLegacyDemoSeed({ password }),
        flagRolloutIdentities: () => seedE2eRolloutIdentities(),
        relaxStaffTwoFactor: () => seedDevTwoFactorPolicy(),
        log: (message) => console.log(message),
      },
      env,
    );
  } finally {
    await pool.end();
  }
}
