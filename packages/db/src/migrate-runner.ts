import path from "node:path";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type pg from "pg";

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Apply pending Drizzle migrations one at a time, each in its own transaction.
 *
 * Drizzle's bundled `node-postgres` migrator wraps every pending migration in a
 * single transaction, which trips PostgreSQL's safety guard for newly added
 * enum values (SQLSTATE 55P04 — "New enum values must be committed before they
 * can be used") whenever a later migration in the same batch references the
 * value as a literal. Running each migration on its own connection with its
 * own `BEGIN`/`COMMIT` ensures earlier DDL is committed before later DDL runs.
 *
 * Idempotency is preserved by reusing Drizzle's `drizzle.__drizzle_migrations`
 * bookkeeping table and `folderMillis` ordering.
 */
export async function runMigrationsPerTransaction(pool: pg.Pool): Promise<void> {
  return runMigrationsPerTransactionThrough(pool);
}

export async function readLastAppliedFolderMillis(pool: pg.Pool): Promise<number | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ created_at: string | number | null }>(
      `select created_at
       from "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"
       order by created_at desc
       limit 1`,
    );
    const value = result.rows[0]?.created_at;
    return value == null ? null : Number(value);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "42P01" || code === "3F000") return null;
    throw err;
  } finally {
    client.release();
  }
}

export async function runMigrationsPerTransactionThrough(
  pool: pg.Pool,
  throughFolderMillis?: number,
): Promise<void> {
  const migrationsFolder = path.join(__dirname, "../drizzle");
  const migrations = readMigrationFiles({ migrationsFolder });

  const setupClient = await pool.connect();
  let lastApplied: number | null;
  let appliedMigrations: { hash: string; created_at: string | number | null }[];
  try {
    await setupClient.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
    await setupClient.query(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`,
    );
    const result = await setupClient.query<{
      hash: string;
      created_at: string | number | null;
    }>(
      `select hash, created_at
       from "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"
       order by created_at asc`,
    );
    appliedMigrations = result.rows;
    const row = result.rows.at(-1);
    lastApplied = row?.created_at == null ? null : Number(row.created_at);
  } finally {
    setupClient.release();
  }

  if (lastApplied != null) {
    const appliedByTimestamp = new Map<number, string>();
    for (const applied of appliedMigrations) {
      if (applied.created_at == null) {
        throw new Error("Migration history contains a row without created_at");
      }
      const createdAt = Number(applied.created_at);
      if (appliedByTimestamp.has(createdAt)) {
        throw new Error(`Migration history contains duplicate timestamp ${createdAt}`);
      }
      appliedByTimestamp.set(createdAt, applied.hash);
    }

    for (const migration of migrations) {
      if (migration.folderMillis > lastApplied) break;
      const appliedHash = appliedByTimestamp.get(migration.folderMillis);
      if (!appliedHash) {
        throw new Error(
          `Migration history is missing ${migration.folderMillis} before applied timestamp ${lastApplied}; manual reconciliation is required`,
        );
      }
      if (appliedHash !== migration.hash) {
        throw new Error(
          `Migration history diverged at ${migration.folderMillis}; manual reconciliation is required`,
        );
      }
    }
  }

  for (const migration of migrations) {
    if (throughFolderMillis !== undefined && migration.folderMillis > throughFolderMillis) {
      break;
    }
    if (lastApplied != null && lastApplied >= migration.folderMillis) {
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const stmt of migration.sql) {
        const trimmed = stmt.trim();
        if (!trimmed) continue;
        await client.query(trimmed);
      }
      await client.query(
        `insert into "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at") values ($1, $2)`,
        [migration.hash, migration.folderMillis],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    lastApplied = migration.folderMillis;
  }
}
