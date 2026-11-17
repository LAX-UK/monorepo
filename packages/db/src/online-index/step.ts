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

type IndexState = { schema: string; valid: boolean } | null;

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function tableSchema(client: OnlineIndexClient, table: string): Promise<string | null> {
  const { rows } = await client.query<{ schema: string }>(
    `SELECT n.nspname AS schema
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.oid = to_regclass($1)`,
    [table],
  );
  return rows[0]?.schema ?? null;
}

async function indexState(
  client: OnlineIndexClient,
  schema: string,
  indexName: string,
): Promise<IndexState> {
  const { rows } = await client.query<{ valid: boolean }>(
    `SELECT i.indisvalid AS valid
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2`,
    [schema, indexName],
  );
  const row = rows[0];
  return row ? { schema, valid: row.valid } : null;
}

async function buildOne(
  client: OnlineIndexClient,
  tag: string,
  statement: OnlineIndexStatement,
  log: OnlineIndexLogger,
  now: () => number,
): Promise<void> {
  const label = `${tag}: ${statement.indexName}`;
  const schema = await tableSchema(client, statement.table);
  if (schema === null) {
    // The table is created by a pending migration, so nothing writes to it yet; the
    // migration builds the index inside its own transaction.
    log(`Online index ${label}: skipped, ${statement.table} does not exist yet.`);
    return;
  }

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
    const after = await indexState(client, schema, statement.indexName).catch(() => null);
    let cleanup = "no index was left behind";
    if (after && !after.valid) {
      const qualified = `${quoteIdent(schema)}.${quoteIdent(statement.indexName)}`;
      try {
        await client.query(`DROP INDEX CONCURRENTLY IF EXISTS ${qualified}`);
        cleanup = `dropped the INVALID index ${qualified} it left`;
      } catch (dropError) {
        cleanup = `could not drop the INVALID index ${qualified} it left (${messageOf(dropError)}); drop it by hand`;
      }
    }
    throw new OnlineIndexBuildError(
      `Online index ${label} failed: ${messageOf(error)}; ${cleanup}. No migration was applied.`,
      { cause: error },
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
