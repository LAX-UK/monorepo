import { runDevSeed } from "./dev-runner.js";

export type SeedCliMode = "seed";

export type SeedCliOptions = {
  env: "dev" | "prod" | "test";
  mode: SeedCliMode;
  dryRun: boolean;
};

function parseArgs(argv: string[]): SeedCliOptions {
  let env: SeedCliOptions["env"] = "dev";
  let dryRun = false;
  for (const a of argv) {
    if (a === "--env=prod" || a === "--prod") env = "prod";
    else if (a === "--env=dev" || a === "--dev") env = "dev";
    else if (a === "--env=test" || a === "--test") env = "test";
    else if (a === "--dry-run") dryRun = true;
  }
  return { env, mode: "seed", dryRun };
}

/**
 * Seed entry point. Today only the dev/demo seed is wired up.
 *
 * Reusable infra for a future production bootstrap lives in:
 *   - `../shared/ids.ts` (deterministic UUID v5 helper)
 *   - `../shared/terms.ts` (default buyer-premium rate + COS text)
 *   - `../test/minimal.ts` (placeholder for integration test fixtures)
 *
 * When a new production bootstrap is needed, add an advisory-locked runner here
 * and register it behind `env === "prod"`.
 */
export async function runSeedCli(argv: string[]): Promise<void> {
  const { env, dryRun } = parseArgs(argv);

  if (env === "test") {
    console.log("[seed] test env: use Vitest fixtures from packages/db/src/seed/test/minimal.ts");
    return;
  }

  if (env === "prod") {
    throw new Error(
      "[seed] No production seeder is registered. Wire one up in packages/db/src/seed/runners/cli.ts.",
    );
  }

  if (dryRun) {
    console.warn("[seed] --dry-run is ignored for dev seed (full wipe + reload).");
  }
  await runDevSeed();
}

async function main() {
  await runSeedCli(process.argv.slice(2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
