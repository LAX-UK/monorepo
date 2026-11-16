/**
 * Marks DATABASE_URL's database as a demo seed target (the `demo_seed_target` row, migration 0398).
 * Run it as the database owner, once, on a CI, local or test database. It applies the same address
 * checks as the seeds and never touches an existing mark, so it cannot be used to relabel a
 * database that is already marked.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:seed:mark-demo-target [local|test] [marked-by]
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../ssl.js";
import {
  assertSeedEnvironment,
  isLocalSeedAddress,
  seedTargetEnvFromProcess,
} from "../shared/seed-target-guard.js";

export type MarkDemoTargetArgs = { environment: "test" | "local"; markedBy: string };

/**
 * "local" lets the seeds use the local password and relax staff two-factor, so only a local
 * address may be marked "local". A test database is marked "test".
 */
export function assertMarkFitsAddress(
  args: MarkDemoTargetArgs,
  env: { databaseUrl: string | undefined; appEnv?: string | undefined },
): void {
  if (args.environment === "local" && !isLocalSeedAddress(env)) {
    throw new Error(
      '[mark-demo-target] only a local database (localhost or a Compose service, no APP_ENV=test) may be marked "local"; mark a test database "test"',
    );
  }
}

export function parseMarkDemoTargetArgs(argv: string[]): MarkDemoTargetArgs {
  const [environment = "local", markedBy = "ci"] = argv;
  if (environment !== "test" && environment !== "local") {
    throw new Error(
      `[mark-demo-target] environment must be "test" or "local", got "${environment}"`,
    );
  }
  if (!markedBy.trim()) throw new Error("[mark-demo-target] marked-by must not be empty");
  return { environment, markedBy };
}

async function main() {
  const args = parseMarkDemoTargetArgs(process.argv.slice(2));
  const env = seedTargetEnvFromProcess();
  const url = assertSeedEnvironment("mark-demo-target", env);
  assertMarkFitsAddress(args, env);
  const pool = new pg.Pool(buildPgConnectionConfig(url));
  try {
    const result = await pool.query(
      "insert into demo_seed_target (environment, database_name, marked_by) values ($1, current_database(), $2) on conflict do nothing",
      [args.environment, args.markedBy],
    );
    console.log(
      result.rowCount
        ? `[mark-demo-target] marked this database as "${args.environment}"`
        : "[mark-demo-target] already marked; left as it is",
    );
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1]?.endsWith("mark-demo-target-cli.ts") ||
  process.argv[1]?.endsWith("mark-demo-target-cli.js")
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
