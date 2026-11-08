import { createDb } from "@auction/db";

/**
 * The alert tables (`bid_alert_*`, `visitor_sale_alert_subscriber`) are shared by several
 * integration test files that vitest runs in parallel against one database. Some of them clear
 * whole tables or prune everything stale, which deletes the rows another file just inserted and
 * fails it with a foreign-key error. Each file takes this lock for its whole run instead:
 *
 * - `exclusive` for a file that deletes rows it did not create (clearing tables, global prunes);
 * - `shared` for a file that only adds and reads its own uniquely named rows.
 *
 * Shared holders run together; an exclusive holder runs alone. The lock is a Postgres advisory
 * lock held by one dedicated connection, so it also holds across test processes and is released
 * by the database if the process dies.
 */
const LOCK_NAME = "persistence.alert-tables.integration-tests";

export type AlertTablesLockMode = "exclusive" | "shared";

type LockConnection = {
  query(text: string, values?: unknown[]): Promise<unknown>;
  release(): void;
};
type LockPool = { connect(): Promise<LockConnection>; end(): Promise<void> };

/** Waits for the lock, then returns the function that gives it back. */
export async function acquireAlertTablesLock(
  connectionString: string,
  mode: AlertTablesLockMode,
): Promise<() => Promise<void>> {
  const pool = (createDb(connectionString) as unknown as { $client: LockPool }).$client;
  const connection = await pool.connect();
  const fn = mode === "exclusive" ? "pg_advisory_lock" : "pg_advisory_lock_shared";
  await connection.query(`select ${fn}(hashtext($1))`, [LOCK_NAME]);
  return async () => {
    const unlock = mode === "exclusive" ? "pg_advisory_unlock" : "pg_advisory_unlock_shared";
    try {
      await connection.query(`select ${unlock}(hashtext($1))`, [LOCK_NAME]);
    } finally {
      connection.release();
      await pool.end();
    }
  };
}

/** How long a file may wait for the others to finish before its first test. */
const ALERT_TABLES_LOCK_WAIT_MS = 10 * 60 * 1000;

type SuiteHooks = {
  beforeAll(fn: () => Promise<void>, timeout: number): void;
  afterAll(fn: () => Promise<void>): void;
};

/**
 * Holds the alert tables for the whole of the calling test file; does nothing without a database.
 * Call it once at the top of the file, passing vitest's `beforeAll` and `afterAll`.
 */
export function holdAlertTablesLock(hooks: SuiteHooks, mode: AlertTablesLockMode): void {
  const connectionString = process.env.DATABASE_URL;
  let release: (() => Promise<void>) | undefined;
  hooks.beforeAll(async () => {
    if (connectionString) release = await acquireAlertTablesLock(connectionString, mode);
  }, ALERT_TABLES_LOCK_WAIT_MS);
  hooks.afterAll(async () => {
    await release?.();
  });
}
