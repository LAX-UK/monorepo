/**
 * Marks DATABASE_URL's database as a demo seed target (the `demo_seed_target` row, migration 0398).
 * Run it as the database owner, once, on a CI, local or test database. It applies the same address
 * checks as the seeds and never touches an existing mark, so it cannot be used to relabel a
 * database that is already marked. The seeds themselves never write the mark.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:seed:mark-demo-target [local|test] [marked-by] [--existing-local-database]
 *
 * `pnpm db:seed` (`db:seed:local`) and `db:seed:docker` run it with "local" before the dev seed.
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../ssl.js";
import {
  type SeedTargetEnv,
  assertSeedEnvironment,
  isLocalSeedAddress,
  seedTargetEnvFromProcess,
} from "../shared/seed-target-guard.js";

export type MarkDemoTargetArgs = {
  environment: "test" | "local";
  markedBy: string;
  /** The operator says an unmarked database that already has users is their own local one. */
  existingLocalDatabase: boolean;
};

const EXISTING_LOCAL_FLAG = "--existing-local-database";

/**
 * "local" lets the seeds use the local password and relax staff two-factor, so only a local
 * address may be marked "local". A test database is marked "test".
 */
export function assertMarkFitsAddress(
  args: Pick<MarkDemoTargetArgs, "environment">,
  env: { databaseUrl: string | undefined; appEnv?: string | undefined },
): void {
  if (args.environment === "local" && !isLocalSeedAddress(env)) {
    throw new Error(
      '[mark-demo-target] only a local database (localhost or the Compose "postgres"/"db" service, no APP_ENV=test) may be marked "local"; mark a test database "test"',
    );
  }
}

export function parseMarkDemoTargetArgs(argv: string[]): MarkDemoTargetArgs {
  const existingLocalDatabase = argv.includes(EXISTING_LOCAL_FLAG);
  const positional = argv.filter((arg) => arg !== EXISTING_LOCAL_FLAG);
  const [environment = "local", markedBy = "ci"] = positional;
  if (environment !== "test" && environment !== "local") {
    throw new Error(
      `[mark-demo-target] environment must be "test" or "local", got "${environment}"`,
    );
  }
  if (!markedBy.trim()) throw new Error("[mark-demo-target] marked-by must not be empty");
  return { environment, markedBy, existingLocalDatabase };
}

/** The part of a pg client or pool this needs. */
export type MarkDemoTargetClient = {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
};

/**
 * Writes the mark, unless the database already has one. A loopback address can be a tunnel or
 * port-forward to a remote database, so "local" is refused on an unmarked database that already
 * has users unless the operator says it is their own local one (--existing-local-database). A
 * fresh local database has no users; test and production always do.
 */
export async function markDemoTarget(
  client: MarkDemoTargetClient,
  args: MarkDemoTargetArgs,
  env: SeedTargetEnv,
): Promise<"marked" | "already-marked"> {
  assertSeedEnvironment("mark-demo-target", env);
  assertMarkFitsAddress(args, env);
  const existing = await client.query(
    "select environment from demo_seed_target where id = true limit 1",
  );
  if (existing.rows.length > 0) return "already-marked";
  if (args.environment === "local" && !args.existingLocalDatabase) {
    const users = await client.query(
      `select case when to_regclass('public."user"') is null then 0 else (select count(*)::int from public."user") end as count`,
    );
    const count = Number(users.rows[0]?.count ?? 0);
    if (count > 0) {
      throw new Error(
        `[mark-demo-target] refusing to mark this database "local": it is not marked and already has ${count} users. A loopback address can be a tunnel to a remote database. If this is your own local database, run again with ${EXISTING_LOCAL_FLAG}.`,
      );
    }
  }
  const result = await client.query(
    "insert into demo_seed_target (environment, database_name, marked_by) values ($1, current_database(), $2) on conflict do nothing",
    [args.environment, args.markedBy],
  );
  return result.rowCount ? "marked" : "already-marked";
}

async function main() {
  const args = parseMarkDemoTargetArgs(process.argv.slice(2));
  const env = seedTargetEnvFromProcess();
  const url = assertSeedEnvironment("mark-demo-target", env);
  const pool = new pg.Pool(buildPgConnectionConfig(url));
  try {
    const outcome = await markDemoTarget(pool, args, env);
    console.log(
      outcome === "marked"
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
