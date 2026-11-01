import { randomUUID } from "node:crypto";
import pg from "pg";
import { buildPgConnectionConfig } from "../ssl.js";

/** Disposable databases on the Postgres behind MIGRATION_TEST_DATABASE_URL, for integration tests. */

export const migrationTestDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;

function isExpectedTeardownPoolError(error: Error): boolean {
  return (error as Error & { code?: string }).code === "57P01";
}

function throwCollectedErrors(errors: unknown[]): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, "Temporary migration database failed");
  }
}

export async function withTemporaryDatabase(
  run: (pool: pg.Pool, databaseUrl: string) => Promise<void>,
): Promise<void> {
  if (!migrationTestDatabaseUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
  const databaseName = `auction_migration_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(migrationTestDatabaseUrl);
  adminUrl.pathname = "/postgres";
  const databaseUrl = new URL(migrationTestDatabaseUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const admin = new pg.Client(buildPgConnectionConfig(adminUrl.toString()));
  const errors: unknown[] = [];
  let databaseCreated = false;

  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const pool = new pg.Pool(buildPgConnectionConfig(databaseUrl.toString()));
    const unexpectedPoolErrors: Error[] = [];
    let teardownStarted = false;
    pool.on("error", (error) => {
      if (!teardownStarted || !isExpectedTeardownPoolError(error)) {
        unexpectedPoolErrors.push(error);
      }
    });
    try {
      await run(pool, databaseUrl.toString());
    } catch (error) {
      errors.push(error);
    } finally {
      teardownStarted = true;
      try {
        await pool.end();
      } catch (error) {
        errors.push(error);
      }
      try {
        await admin.query(
          `SELECT pg_terminate_backend(pid)
           FROM pg_stat_activity
           WHERE datname = $1
             AND pid <> pg_backend_pid()`,
          [databaseName],
        );
      } catch (error) {
        errors.push(error);
      }
      errors.push(...unexpectedPoolErrors);
    }
  } catch (error) {
    errors.push(error);
  } finally {
    if (databaseCreated) {
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await admin.end();
    } catch (error) {
      errors.push(error);
    }
  }
  throwCollectedErrors(errors);
}
