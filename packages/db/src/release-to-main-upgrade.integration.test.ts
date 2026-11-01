import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { readJournalMigrations, runMigrationsPerTransaction } from "./migrate-runner.js";
import { PgReleaseLineageUnitOfWork } from "./release-lineage-archive.js";
import {
  APPROVED_RELEASE_HEAD,
  APPROVED_RELEASE_ROWS,
  RELEASE_LINEAGE_ADOPTIONS,
  RELEASE_LINEAGE_BASELINE,
} from "./release-lineage-mapping.js";
import { ReleaseLineageRefusal } from "./release-lineage-normalisation.js";
import { type NormalisationMode, normaliseReleaseLineage } from "./release-lineage-normaliser.js";
import { buildPgConnectionConfig } from "./ssl.js";
import { buildProductionDatabaseAtReleaseHead } from "./testing/production-ledger-fixture.js";
import { migrationTestDatabaseUrl, withTemporaryDatabase } from "./testing/temporary-database.js";

/**
 * Promotion of main onto production's release-lineage database, end to end: a ledger at the
 * approved release head, normalisation, then the real `migrate-prod.js` entrypoint at `head`.
 * CI builds @auction/db before tests, so `dist/migrate-prod.js` is the shipped artefact.
 */

const run = promisify(execFile);
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const MIGRATE_PROD_JS = resolve(PACKAGE_ROOT, "dist/migrate-prod.js");
const NORMALISE_CLI = resolve(PACKAGE_ROOT, "src/scripts/normalise-release-lineage.ts");
const journal = readJournalMigrations();
const JOURNAL_HEAD = journal.at(-1)?.folderMillis;
/** Rows main and release share: 0000 through the baseline. */
const RELEASE_LINEAGE_BASELINE_ROWS = journal.filter(
  (m) => m.folderMillis <= RELEASE_LINEAGE_BASELINE.when,
).length;

type LedgerRow = { hash: string; created_at: string };

async function readLedger(pool: pg.Pool): Promise<LedgerRow[]> {
  const result = await pool.query<LedgerRow>(
    "SELECT hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at",
  );
  return result.rows;
}

async function archiveExists(pool: pg.Pool): Promise<boolean> {
  const result = await pool.query<{ present: boolean }>(
    "SELECT to_regclass('drizzle.__release_lineage_archive') IS NOT NULL AS present",
  );
  return result.rows[0]?.present ?? false;
}

async function normalise(databaseUrl: string, mode: NormalisationMode) {
  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    return await normaliseReleaseLineage({
      unitOfWork: new PgReleaseLineageUnitOfWork(client),
      journal,
      releaseHead: APPROVED_RELEASE_HEAD,
      mode,
    });
  } finally {
    await client.end();
  }
}

async function migrateProd(databaseUrl: string, through: string) {
  if (!existsSync(MIGRATE_PROD_JS)) {
    throw new Error("Build @auction/db first: pnpm --filter @auction/db build");
  }
  return run(process.execPath, [MIGRATE_PROD_JS], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, DATABASE_URL_OWNER: databaseUrl, PRODUCTION_MIGRATION_THROUGH: through },
  });
}

/** Tables, columns, constraints, indexes, triggers, functions and enums outside `drizzle`. */
async function describeSchema(pool: pg.Pool): Promise<string[]> {
  const result = await pool.query<{ item: string }>(
    `SELECT 'column ' || table_schema || '.' || table_name || '.' || column_name || ' ' || udt_name
              || ' nullable=' || is_nullable || ' default=' || coalesce(column_default, '') AS item
       FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'drizzle')
     UNION ALL
     SELECT 'constraint ' || n.nspname || '.' || c.relname || '.' || con.conname || ' '
              || pg_get_constraintdef(con.oid)
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'drizzle')
     UNION ALL
     SELECT 'index ' || schemaname || '.' || indexname || ' ' || indexdef
       FROM pg_indexes
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'drizzle')
     UNION ALL
     SELECT 'trigger ' || event_object_table || '.' || trigger_name || ' ' || event_manipulation
              || ' ' || action_statement
       FROM information_schema.triggers
     UNION ALL
     SELECT 'function ' || n.nspname || '.' || p.proname || ' ' || md5(pg_get_functiondef(p.oid))
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prokind IN ('f', 'p')
     UNION ALL
     SELECT 'enum ' || t.typname || ' ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      GROUP BY t.typname`,
  );
  return result.rows.map((row) => row.item).sort();
}

async function readCategorySlugs(pool: pg.Pool): Promise<string[]> {
  const result = await pool.query<{ slug: string }>("SELECT slug FROM category ORDER BY slug");
  return result.rows.map((row) => row.slug);
}

/** Main's own fresh database at head, for comparison. */
async function cleanMainState(): Promise<{ schema: string[]; categories: string[] }> {
  let state: { schema: string[]; categories: string[] } | undefined;
  await withTemporaryDatabase(async (pool) => {
    await runMigrationsPerTransaction(pool);
    state = { schema: await describeSchema(pool), categories: await readCategorySlugs(pool) };
  });
  if (!state) throw new Error("Clean main database was not built");
  return state;
}

const EARLY_BUYER = "release-early-buyer";
const AUGUST_BUYER = "release-august-buyer";
const ONBOARDED_BUYER = "release-onboarded-buyer";
const ONBOARDED_AT = new Date("2026-09-01T10:00:00.000Z");

async function insertBuyer(pool: pg.Pool, id: string, createdAt: string): Promise<void> {
  await pool.query(
    `INSERT INTO public."user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
     VALUES ($1, $1, $1 || '@example.test', true, $2, $2)`,
    [id, createdAt],
  );
}

/**
 * Production data the release migrations saw: a buyer from before release 0129 (which marks
 * existing buyers as onboarded), then buyers who registered afterwards, one still to choose
 * interests and one who finished.
 */
async function buildProductionWithBuyers(pool: pg.Pool): Promise<void> {
  await buildProductionDatabaseAtReleaseHead(pool, {
    atBaseline: (baseline) => insertBuyer(baseline, EARLY_BUYER, "2026-07-01T09:00:00Z"),
  });
  await insertBuyer(pool, AUGUST_BUYER, "2026-08-15T09:00:00Z");
  await insertBuyer(pool, ONBOARDED_BUYER, "2026-08-20T09:00:00Z");
  await pool.query(
    `UPDATE public."user" SET "category_interests_onboarding_completed_at" = $2 WHERE "id" = $1`,
    [ONBOARDED_BUYER, ONBOARDED_AT],
  );
}

async function readOnboardingCompletion(pool: pg.Pool): Promise<Record<string, Date | null>> {
  const result = await pool.query<{ user_id: string; completed_at: Date | null }>(
    `SELECT "user_id", "category_interests_onboarding_completed_at" AS completed_at
       FROM public.bid_user_profile
      WHERE "user_id" = ANY($1::text[])`,
    [[EARLY_BUYER, AUGUST_BUYER, ONBOARDED_BUYER]],
  );
  return Object.fromEntries(result.rows.map((row) => [row.user_id, row.completed_at]));
}

describe.skipIf(!migrationTestDatabaseUrl)(
  "promoting main onto the production release lineage",
  { timeout: 180_000 },
  () => {
    it("normalises a ledger at the release head and migrate-prod.js head brings it to main's head without re-running adopted SQL", async () => {
      const clean = await cleanMainState();

      await withTemporaryDatabase(async (pool, databaseUrl) => {
        await buildProductionWithBuyers(pool);
        const atReleaseHead = await readLedger(pool);
        expect(atReleaseHead).toHaveLength(RELEASE_LINEAGE_BASELINE_ROWS + 8);
        expect(atReleaseHead.slice(-8)).toEqual(
          APPROVED_RELEASE_ROWS.map((row) => ({
            hash: row.sha256,
            created_at: String(row.releaseWhen),
          })),
        );

        // Main's runner refuses production's ledger until it is normalised.
        await expect(migrateProd(databaseUrl, "head")).rejects.toMatchObject({
          stderr: expect.stringContaining("Migration history diverged at 1788000004000"),
        });

        // Dry run through the CLI: reports the plan, writes nothing.
        const dryRun = await run(
          process.execPath,
          ["--import", "tsx", NORMALISE_CLI, `--release-head=${APPROVED_RELEASE_HEAD}`],
          { cwd: PACKAGE_ROOT, env: { ...process.env, DATABASE_URL_OWNER: databaseUrl } },
        );
        expect(dryRun.stdout).toContain("Will archive 8 release rows");
        expect(dryRun.stdout).toContain("Dry run: nothing was written");
        expect(await readLedger(pool)).toEqual(atReleaseHead);
        expect(await archiveExists(pool)).toBe(false);

        const applied = await normalise(databaseUrl, "apply");
        expect(applied).toMatchObject({ wrote: true, plan: { status: "archive" } });
        const normalised = await readLedger(pool);
        expect(normalised).toEqual(atReleaseHead.slice(0, -8));
        expect(normalised.at(-1)?.created_at).toBe(String(RELEASE_LINEAGE_BASELINE.when));
        const archived = await pool.query(
          `SELECT created_at::text, hash, release_tag, disposition, main_tag, release_head
             FROM drizzle.__release_lineage_archive ORDER BY created_at`,
        );
        expect(archived.rows).toEqual(
          APPROVED_RELEASE_ROWS.map((row) => ({
            created_at: String(row.releaseWhen),
            hash: row.sha256,
            release_tag: row.releaseTag,
            disposition: row.disposition.kind,
            main_tag: row.disposition.kind === "adopt" ? row.disposition.mainTag : null,
            release_head: APPROVED_RELEASE_HEAD,
          })),
        );

        // Idempotent: a second run sees the work done and changes nothing.
        expect(await normalise(databaseUrl, "apply")).toMatchObject({
          wrote: false,
          plan: { status: "already-normalised", mainRowsAboveBaseline: 0 },
        });
        expect(await readLedger(pool)).toEqual(normalised);

        const migrated = await migrateProd(databaseUrl, "head");
        expect(migrated.stdout).toContain("Production migration ceiling: head");
        const adoptedLines = migrated.stdout
          .split("\n")
          .filter((line) => line.startsWith("Adopted "));
        expect(adoptedLines.map((line) => line.split(" ")[1]).sort()).toEqual(
          RELEASE_LINEAGE_ADOPTIONS.map((a) => a.mainTag).sort(),
        );

        const final = await readLedger(pool);
        expect(final).toEqual(
          journal.map((m) => ({ hash: m.hash, created_at: String(m.folderMillis) })),
        );
        expect(Number(final.at(-1)?.created_at)).toBe(JOURNAL_HEAD);

        // Main 0137's backfill did not run again: the August buyer still has interests to choose.
        const completion = await readOnboardingCompletion(pool);
        expect(completion[AUGUST_BUYER]).toBeNull();
        expect(completion[ONBOARDED_BUYER]).toEqual(ONBOARDED_AT);
        expect(completion[EARLY_BUYER]).toBeInstanceOf(Date);

        // Release 0135's projector cursor survives; main reads the same row.
        const projector = await pool.query(
          `SELECT last_processed_event_id::text AS cursor FROM projector_state
            WHERE projector_name = 'payment_refund_notify'`,
        );
        expect(projector.rows).toEqual([{ cursor: "0" }]);

        // Same schema and reference data as a database main built from scratch.
        expect(await describeSchema(pool)).toEqual(clean.schema);
        expect(await readCategorySlugs(pool)).toEqual(clean.categories);

        // Re-running either step afterwards is a no-op.
        expect(await normalise(databaseUrl, "apply")).toMatchObject({
          wrote: false,
          plan: {
            status: "already-normalised",
            mainRowsAboveBaseline: journal.length - RELEASE_LINEAGE_BASELINE_ROWS,
          },
        });
        const again = await migrateProd(databaseUrl, "head");
        expect(again.stdout).not.toContain("Adopted ");
        expect(await readLedger(pool)).toEqual(final);
      });
    });

    it("refuses a ledger with an unknown extra row and writes nothing", async () => {
      await withTemporaryDatabase(async (pool, databaseUrl) => {
        await buildProductionDatabaseAtReleaseHead(pool);
        await pool.query(
          'INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)',
          ["a".repeat(64), 1795593720000],
        );
        const before = await readLedger(pool);

        for (const mode of ["dry-run", "apply"] as const) {
          await expect(normalise(databaseUrl, mode)).rejects.toThrow(ReleaseLineageRefusal);
          await expect(normalise(databaseUrl, mode)).rejects.toThrow(
            /Unknown ledger row at 1795593720000/,
          );
        }
        expect(await readLedger(pool)).toEqual(before);
        expect(await archiveExists(pool)).toBe(false);
      });
    });

    it("refuses a release row whose hash changed and writes nothing", async () => {
      await withTemporaryDatabase(async (pool, databaseUrl) => {
        await buildProductionDatabaseAtReleaseHead(pool);
        await pool.query(
          "UPDATE drizzle.__drizzle_migrations SET hash = $1 WHERE created_at = 1788000005000",
          ["b".repeat(64)],
        );
        const before = await readLedger(pool);

        await expect(normalise(databaseUrl, "apply")).rejects.toThrow(
          /Ledger row 1788000005000 holds b{64}, not the approved 0129_user_category_interests hash/,
        );
        expect(await readLedger(pool)).toEqual(before);
        expect(await archiveExists(pool)).toBe(false);
      });
    });
  },
);
