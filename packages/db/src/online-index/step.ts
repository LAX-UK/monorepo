import type { OnlineIndexDeclaration, OnlineIndexStatement } from "./declarations.js";

/**
 * The online index step of the production migrate: builds declared indexes with
 * `CREATE INDEX CONCURRENTLY` on an autocommit connection, before the transactional runner.
 * Runbook: docs/runbooks/online-index-builds.md.
 */

export const ONLINE_INDEX_APPLICATION_NAME = "lax-online-index";

/**
 * Session settings: wait at most 5 s for the short locks at the start and end of a build,
 * never cut a build short in code (the pre-deploy job timeout bounds it), and be easy to
 * find in pg_stat_activity.
 */
export const ONLINE_INDEX_SESSION_SETTINGS = [
  "SET lock_timeout = '5s'",
  "SET statement_timeout = 0",
  `SET application_name = '${ONLINE_INDEX_APPLICATION_NAME}'`,
] as const;

/** The one database capability the step needs. A `pg.Client` in autocommit mode satisfies it. */
export type OnlineIndexClient = {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>;
};

export type OnlineIndexLogger = (line: string) => void;

export class OnlineIndexBuildError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OnlineIndexBuildError";
  }
}

type IndexState = { oid: number; valid: boolean } | null;
type TableRef = { schema: string; oid: number };

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function tableRef(client: OnlineIndexClient, table: string): Promise<TableRef | null> {
  const { rows } = await client.query<{ schema: string; oid: string | number }>(
    `SELECT n.nspname AS schema, c.oid::bigint AS oid
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.oid = to_regclass($1)`,
    [table],
  );
  const row = rows[0];
  return row ? { schema: row.schema, oid: Number(row.oid) } : null;
}

async function indexState(
  client: OnlineIndexClient,
  schema: string,
  indexName: string,
): Promise<IndexState> {
  const { rows } = await client.query<{ oid: string | number; valid: boolean }>(
    `SELECT c.oid::bigint AS oid, i.indisvalid AS valid
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2`,
    [schema, indexName],
  );
  const row = rows[0];
  return row ? { oid: Number(row.oid), valid: row.valid } : null;
}

/**
 * Other client sessions that may be building this index: a CREATE INDEX in progress on the
 * table or on this index (pg_stat_progress_create_index; a row we may not read the relation of
 * counts too), or a session holding or waiting for the SHARE UPDATE EXCLUSIVE lock that every
 * concurrent build keeps on its table. Autovacuum takes that lock as well and is ignored.
 */
async function otherBuilders(
  client: OnlineIndexClient,
  tableOid: number,
  indexOid: number,
): Promise<number[]> {
  const { rows } = await client.query<{ pid: number }>(
    `SELECT p.pid
       FROM pg_stat_progress_create_index p
      WHERE p.pid <> pg_backend_pid()
        AND p.datname = current_database()
        AND (p.relid IS NULL OR p.relid = $1::bigint::oid OR p.index_relid = $2::bigint::oid)
     UNION
     SELECT l.pid
       FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.pid <> pg_backend_pid()
        AND a.backend_type = 'client backend'
        AND l.locktype = 'relation'
        AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
        AND l.relation IN ($1::bigint::oid, $2::bigint::oid)
        AND l.mode = 'ShareUpdateExclusiveLock'
      ORDER BY 1`,
    [tableOid, indexOid],
  );
  return rows.map((r) => Number(r.pid));
}

/**
 * Decides what to do with the index found after a failed build. It is dropped only when it is
 * INVALID, its OID did not exist before this build, and no other session is building it. If
 * ownership cannot be established it is left in place and the error says so.
 */
async function cleanupAfterFailure(
  client: OnlineIndexClient,
  table: TableRef,
  indexName: string,
): Promise<string> {
  let after: IndexState;
  try {
    after = await indexState(client, table.schema, indexName);
  } catch (error) {
    return `could not check for an INVALID index it may have left (${messageOf(error)}); check ${table.schema}.${indexName} by hand`;
  }
  if (after === null) return "no index was left behind";
  if (after.valid) return `left the valid index ${table.schema}.${indexName} in place`;

  const qualified = `${quoteIdent(table.schema)}.${quoteIdent(indexName)}`;
  let others: number[];
  try {
    others = await otherBuilders(client, table.oid, after.oid);
  } catch (error) {
    return `left the INVALID index ${qualified} in place: could not check whether another session is building it (${messageOf(error)}); see the runbook`;
  }
  if (others.length > 0) {
    return `left the INVALID index ${qualified} in place: another session (pid ${others.join(", ")}) is building on ${table.schema}.${indexName} or its table, so it may not be ours; see the runbook`;
  }
  try {
    await client.query(`DROP INDEX CONCURRENTLY IF EXISTS ${qualified}`);
    return `dropped the INVALID index ${qualified} it left`;
  } catch (dropError) {
    return `could not drop the INVALID index ${qualified} it left (${messageOf(dropError)}); drop it by hand`;
  }
}

async function buildOne(
  client: OnlineIndexClient,
  tag: string,
  statement: OnlineIndexStatement,
  log: OnlineIndexLogger,
  now: () => number,
): Promise<void> {
  const label = `${tag}: ${statement.indexName}`;
  const table = await tableRef(client, statement.table);
  if (table === null) {
    // The table is created by a pending migration, so nothing writes to it yet; the
    // migration builds the index inside its own transaction.
    log(`Online index ${label}: skipped, ${statement.table} does not exist yet.`);
    return;
  }
  const { schema } = table;

  const before = await indexState(client, schema, statement.indexName);
  if (before?.valid) {
    log(`Online index ${label}: already built.`);
    return;
  }
  if (before) {
    // Not ours: a build that failed earlier, or one still running in another session. Both look
    // the same in pg_index, so it is never dropped here.
    throw new OnlineIndexBuildError(
      `Online index ${label}: ${schema}.${statement.indexName} exists but is INVALID (a failed or still running concurrent build). Check pg_stat_progress_create_index, then drop it by hand; see docs/runbooks/online-index-builds.md.`,
    );
  }

  const started = now();
  log(`Online index ${label}: building concurrently on ${statement.table}.`);
  try {
    await client.query(statement.sql);
  } catch (error) {
    // `before` was null, so any index found now has an OID that did not exist before this build.
    const cleanup = await cleanupAfterFailure(client, table, statement.indexName);
    throw new OnlineIndexBuildError(
      `Online index ${label} failed: ${messageOf(error)}; ${cleanup}. No migration was applied.`,
      { cause: error },
    );
  }
  // IF NOT EXISTS skips, without an error, when another session created the index after the
  // check above. That index may be INVALID (its build failed); it is not ours, so it is reported
  // and left alone.
  const after = await indexState(client, schema, statement.indexName);
  if (!after?.valid) {
    throw new OnlineIndexBuildError(
      `Online index ${label}: ${schema}.${statement.indexName} is ${after ? "INVALID" : "missing"} after the build (another session built it at the same time); left in place. See docs/runbooks/online-index-builds.md. No migration was applied.`,
    );
  }
  log(`Online index ${label}: built in ${((now() - started) / 1000).toFixed(1)} s.`);
}

/**
 * Builds every statement of the given declarations in order. The client must not be inside a
 * transaction. Stops at the first failure, after dropping the INVALID index that build created
 * (never a valid index, never one it did not create), and throws OnlineIndexBuildError.
 */
export async function runOnlineIndexStep(
  client: OnlineIndexClient,
  declarations: readonly OnlineIndexDeclaration[],
  options: { log?: OnlineIndexLogger; now?: () => number } = {},
): Promise<void> {
  const log = options.log ?? ((line: string) => console.log(line));
  const now = options.now ?? Date.now;
  if (declarations.length === 0) {
    log("Online index step: nothing to build.");
    return;
  }
  for (const setting of ONLINE_INDEX_SESSION_SETTINGS) await client.query(setting);
  for (const declaration of declarations) {
    for (const statement of declaration.statements) {
      await buildOne(client, declaration.tag, statement, log, now);
    }
  }
}

/** Ledger timestamps already applied; an empty set when the ledger does not exist yet. */
export async function readAppliedFolderMillis(client: OnlineIndexClient): Promise<Set<number>> {
  try {
    const { rows } = await client.query<{ created_at: string | number | null }>(
      `SELECT created_at FROM "drizzle"."__drizzle_migrations"`,
    );
    return new Set(rows.filter((r) => r.created_at != null).map((r) => Number(r.created_at)));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01" || code === "3F000") return new Set();
    throw error;
  }
}
