import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type pg from "pg";
import { runMigrationsPerTransactionThrough } from "../migrate-runner.js";
import {
  APPROVED_RELEASE_ROWS,
  type ApprovedReleaseRow,
  RELEASE_LINEAGE_BASELINE,
} from "../release-lineage-mapping.js";

/**
 * Reproduces production's database at the approved release head: main's shared 0000–0127
 * (byte-identical to release), then release 0128–0135 executed in release order and recorded
 * with release's stamps and hashes, as release's migrator wrote them.
 *
 * Release SQL that main also ships is read from main's drizzle folder; release-only SQL is
 * vendored in `release-head/`. Every file is checked against the approved release hash before
 * it runs, so the fixture cannot drift from what production executed.
 */

const DRIZZLE_FOLDER = resolve(import.meta.dirname, "../../drizzle");
const RELEASE_ONLY_FOLDER = resolve(import.meta.dirname, "release-head");

function releaseSqlPath(row: ApprovedReleaseRow): string {
  return row.disposition.kind === "adopt"
    ? resolve(DRIZZLE_FOLDER, `${row.disposition.mainTag}.sql`)
    : resolve(RELEASE_ONLY_FOLDER, `${row.releaseTag}.sql`);
}

export function readReleaseSql(row: ApprovedReleaseRow): string {
  const bytes = readFileSync(releaseSqlPath(row));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== row.sha256) {
    throw new Error(`${row.releaseTag} fixture SQL hash ${hash} is not the approved ${row.sha256}`);
  }
  return bytes.toString("utf8");
}

async function applyReleaseMigration(pool: pg.Pool, row: ApprovedReleaseRow): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of readReleaseSql(row).split("--> statement-breakpoint")) {
      if (statement.trim()) await client.query(statement.trim());
    }
    await client.query(
      'INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)',
      [row.sha256, row.releaseWhen],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export type ReleaseHeadFixtureHooks = {
  /** Runs at the shared baseline, before any release-only migration (data release then saw). */
  atBaseline?: (pool: pg.Pool) => Promise<void>;
};

export async function buildProductionDatabaseAtReleaseHead(
  pool: pg.Pool,
  hooks: ReleaseHeadFixtureHooks = {},
): Promise<void> {
  await runMigrationsPerTransactionThrough(pool, RELEASE_LINEAGE_BASELINE.when);
  await hooks.atBaseline?.(pool);
  for (const row of APPROVED_RELEASE_ROWS) {
    await applyReleaseMigration(pool, row);
  }
}
