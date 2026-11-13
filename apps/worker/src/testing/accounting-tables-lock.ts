import { createDb } from "@auction/db";

/**
 * The accounting integration files share the accounting switch and the document queue: each aims
 * Books at a mode, cancels what is left in the queue before a case and resets the switch after.
 * Run in parallel they undo each other, so each file holds this Postgres advisory lock for its
 * whole run (one dedicated connection; the database releases it if the process dies).
 */
const LOCK_NAME = "worker.accounting-tables.integration-tests";
const WAIT_MS = 10 * 60 * 1000;

type LockConnection = {
  query(text: string, values?: unknown[]): Promise<unknown>;
  release(): void;
};
type LockPool = { connect(): Promise<LockConnection>; end(): Promise<void> };

type SuiteHooks = {
  beforeAll(fn: () => Promise<void>, timeout: number): void;
  afterAll(fn: () => Promise<void>): void;
};

/** Holds the accounting tables for the calling file; does nothing without a database. */
export function holdAccountingTablesLock(hooks: SuiteHooks): void {
  const connectionString = process.env.DATABASE_URL;
  let release: (() => Promise<void>) | undefined;
  hooks.beforeAll(async () => {
    if (!connectionString) return;
    const pool = (createDb(connectionString) as unknown as { $client: LockPool }).$client;
    const connection = await pool.connect();
    await connection.query("select pg_advisory_lock(hashtext($1))", [LOCK_NAME]);
    release = async () => {
      try {
        await connection.query("select pg_advisory_unlock(hashtext($1))", [LOCK_NAME]);
      } finally {
        connection.release();
        await pool.end();
      }
    };
  }, WAIT_MS);
  hooks.afterAll(async () => {
    await release?.();
  });
}
