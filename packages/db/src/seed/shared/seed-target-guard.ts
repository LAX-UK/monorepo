import { type DemoSeedTargetMark, assertDemoSeedDatabase } from "./demo-seed-target.js";

/**
 * The one guard every seed that writes accounts, passwords or staff grants goes through, so a
 * seed can only ever land on a database that said for itself that it takes demo data (the
 * `demo_seed_target` mark, migration 0398):
 *
 * 1. `assertSeedEnvironment`: the environment and address must not look like production.
 * 2. `assertSeedTarget`: the database must carry the mark. A seed never writes the mark itself, and
 *    an address is never enough on its own: a loopback address can be a tunnel or port-forward to a
 *    remote database. Local databases are marked "local" by the local entry points
 *    (`db:seed:local`, `db:seed:docker`) through `mark-demo-target`; every other database is marked
 *    once by its owner (docs/runbooks/demo-seed.md). An unmarked database is refused.
 * 3. `seedAccountPassword`: only a hermetic database (marked "local" and at a local address) gets
 *    the local password. Any other target needs the password from the `SEED_ACCOUNT_PASSWORD`
 *    secret. Seed functions never default to the local password: their callers pass the result
 *    of this function.
 */

/**
 * The password seeded sign-ins share on a hermetic database (a local or CI database marked
 * "local"). Only `seedAccountPassword` hands it out; never pass it to a seed directly.
 */
export const LOCAL_SEED_PASSWORD = "Password123!";

/** Environment variable that holds the seeded sign-in password for every non-local target. */
export const SEED_ACCOUNT_PASSWORD_ENV = "SEED_ACCOUNT_PASSWORD";

const MIN_SEED_ACCOUNT_PASSWORD_LENGTH = 16;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
/** The Docker Compose service names a local database runs under (docker-compose.yml). */
const COMPOSE_DATABASE_HOSTS = new Set(["postgres", "db"]);
const PRODUCTION_ENVS = new Set(["production", "prod"]);
const DEPLOYED_APP_ENVS = new Set(["test", "production", "prod"]);

export type SeedTargetEnv = {
  databaseUrl: string | undefined;
  nodeEnv?: string | undefined;
  appEnv?: string | undefined;
  /** From SEED_ACCOUNT_PASSWORD; required for any target that is not local. */
  seedAccountPassword?: string | undefined;
};

export type SeedTarget = {
  environment: NonNullable<DemoSeedTargetMark>["environment"];
  /**
   * A local database marked "local": the only kind that may get the local password and the
   * relaxed staff two-factor policy.
   */
  hermetic: boolean;
};

/** Reads the guard's inputs from the process environment. */
export function seedTargetEnvFromProcess(
  databaseUrlVariable = "DATABASE_URL",
  source: NodeJS.ProcessEnv = process.env,
): SeedTargetEnv {
  return {
    databaseUrl: source[databaseUrlVariable],
    nodeEnv: source.NODE_ENV,
    appEnv: source.APP_ENV,
    seedAccountPassword: source[SEED_ACCOUNT_PASSWORD_ENV],
  };
}

function hostOf(databaseUrl: string): string {
  return new URL(databaseUrl).hostname.toLowerCase();
}

function isDeployedAppEnv(appEnv: string | undefined): boolean {
  return DEPLOYED_APP_ENVS.has((appEnv ?? "").trim().toLowerCase());
}

/**
 * Loopback, or one of the Docker Compose database service names (`postgres`, `db`), with no
 * deployed environment. This is only half of "local": a loopback address can be a tunnel to a
 * remote database, so a database is hermetic only when it also carries the "local" mark.
 */
export function isLocalSeedAddress(env: Pick<SeedTargetEnv, "databaseUrl" | "appEnv">): boolean {
  if (!env.databaseUrl || isDeployedAppEnv(env.appEnv)) return false;
  const host = hostOf(env.databaseUrl);
  return LOOPBACK_HOSTS.has(host) || COMPOSE_DATABASE_HOSTS.has(host);
}

/**
 * Refuses a production environment or address before any connection is made, and returns the
 * database address. The mark check (`assertSeedTarget`) is what actually protects production;
 * this only stops the obvious mistakes early.
 */
export function assertSeedEnvironment(seed: string, env: SeedTargetEnv): string {
  if (!env.databaseUrl) throw new Error(`[${seed}] a database address is required`);
  const production = (value: string | undefined) =>
    PRODUCTION_ENVS.has((value ?? "").trim().toLowerCase());
  if (production(env.nodeEnv) || production(env.appEnv)) {
    throw new Error(`[${seed}] refusing to run in production`);
  }
  if (/prod/i.test(hostOf(env.databaseUrl))) {
    throw new Error(`[${seed}] refusing a production database host`);
  }
  return env.databaseUrl;
}

type Queryable = Parameters<typeof assertDemoSeedDatabase>[0];

/**
 * Refuses, before anything is written, any database that is production-like or has no demo seed
 * mark. It never writes the mark, whatever the address: an unmarked database is refused, and the
 * error says how to mark a local one. Returns what the target is.
 */
export async function assertSeedTarget(
  db: Queryable,
  seed: string,
  env: SeedTargetEnv,
): Promise<SeedTarget> {
  assertSeedEnvironment(seed, env);
  const mark = await assertDemoSeedDatabase(db, seed);
  return {
    environment: mark.environment,
    hermetic: mark.environment === "local" && isLocalSeedAddress(env),
  };
}

/**
 * The password every account the seed creates gets. A hermetic database may use the local
 * password; any other target must supply its own through SEED_ACCOUNT_PASSWORD, so a password
 * that is written in this public repository never reaches a deployed environment.
 */
export function seedAccountPassword(
  target: SeedTarget,
  env: Pick<SeedTargetEnv, "seedAccountPassword">,
  seed: string,
): string {
  const supplied = env.seedAccountPassword?.trim();
  if (target.hermetic) return supplied || LOCAL_SEED_PASSWORD;
  if (!supplied) {
    throw new Error(
      `[${seed}] refusing to seed: ${SEED_ACCOUNT_PASSWORD_ENV} is required for a ${target.environment} database (only a local database may use the local password)`,
    );
  }
  if (supplied === LOCAL_SEED_PASSWORD || supplied.length < MIN_SEED_ACCOUNT_PASSWORD_LENGTH) {
    throw new Error(
      `[${seed}] refusing to seed: ${SEED_ACCOUNT_PASSWORD_ENV} must be at least ${MIN_SEED_ACCOUNT_PASSWORD_LENGTH} characters and not the local password`,
    );
  }
  return supplied;
}

/**
 * The shape every seed CLI that writes accounts, passwords or staff grants uses: check the target,
 * pick the password, then write. Nothing runs when the target or the password is refused.
 */
export async function withSeedTarget<T>(
  db: Queryable,
  seed: string,
  env: SeedTargetEnv,
  write: (password: string, target: SeedTarget) => Promise<T>,
): Promise<T> {
  const target = await assertSeedTarget(db, seed, env);
  return write(seedAccountPassword(target, env, seed), target);
}
