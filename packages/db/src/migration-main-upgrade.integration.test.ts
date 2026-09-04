import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { applyApplicationRoleGrants } from "./migrate-roles.js";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const RELEASED_0137_FOLDER_MILLIS = 1788000013000;
const MAIN_0139_FOLDER_MILLIS = 1788000015000;
const CONTRACT_0153_FOLDER_MILLIS = 1788000029000;
const SUBJECT_0154_FOLDER_MILLIS = 1788000030000;
const PII_REPAIR_0156_FOLDER_MILLIS = 1788000032000;
const BEFORE_DIRECTORY_0158_FOLDER_MILLIS = 1788000034000;
const DIRECTORY_0159_FOLDER_MILLIS = 1788000035000;
const WORKER_CUTOVER_0160_FOLDER_MILLIS = 1788000036000;
const FINAL_FOLDER_MILLIS = 1788000037000;

function isExpectedTeardownPoolError(error: Error): boolean {
  return (error as Error & { code?: string }).code === "57P01";
}

function throwCollectedErrors(errors: unknown[]): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, "Temporary migration database failed");
  }
}

async function withTemporaryDatabase(
  run: (pool: pg.Pool, databaseUrl: string) => Promise<void>,
): Promise<void> {
  if (!migrationUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
  const databaseName = `auction_migration_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(migrationUrl);
  adminUrl.pathname = "/postgres";
  const databaseUrl = new URL(migrationUrl);
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

async function executeMigrationSql(pool: pg.Pool, fileName: string): Promise<void> {
  const sql = await readFile(resolve(import.meta.dirname, "../drizzle", fileName), "utf8");
  await pool.query(sql.replaceAll("--> statement-breakpoint", ""));
}

async function expectFinalMigrationState(pool: pg.Pool): Promise<void> {
  const [lastMigration, profileMarker, identityMarker, interestOwner] = await Promise.all([
    pool.query<{ created_at: string }>(
      `SELECT created_at
       FROM drizzle.__drizzle_migrations
       ORDER BY created_at DESC
       LIMIT 1`,
    ),
    pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'bid_user_profile'
         AND column_name = 'category_interests_onboarding_completed_at'`,
    ),
    pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'user'
         AND column_name = 'category_interests_onboarding_completed_at'`,
    ),
    pool.query<{ target_table: string }>(
      `SELECT confrelid::regclass::text AS target_table
       FROM pg_constraint
       WHERE conrelid = 'public.user_category_interest'::regclass
         AND conname = 'user_category_interest_user_id_fkey'`,
    ),
  ]);

  expect(Number(lastMigration.rows[0]?.created_at)).toBe(FINAL_FOLDER_MILLIS);
  expect(profileMarker.rows).toHaveLength(1);
  expect(identityMarker.rows).toHaveLength(0);
  expect(interestOwner.rows).toEqual([{ target_table: "bid_user_profile" }]);
}

describe.skipIf(!migrationUrl)("main-to-Identity migration upgrade", { timeout: 30_000 }, () => {
  it("surfaces unrelated pool errors instead of swallowing them", async () => {
    await expect(
      withTemporaryDatabase(async (pool) => {
        pool.emit("error", Object.assign(new Error("unexpected pool failure"), { code: "XX000" }));
      }),
    ).rejects.toThrow("unexpected pool failure");
  });

  it("applies the complete lineage to a clean database", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      await expectFinalMigrationState(pool);
    });
  });

  it("preserves buyer-interest state from the released main checkpoint", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, MAIN_0139_FOLDER_MILLIS);

      const userId = "migration-upgrade-user";
      const completedAt = new Date("2026-08-20T12:00:00.000Z");
      const categoryId = "c1000001-0000-4000-8000-000000000001";
      await pool.query(
        `INSERT INTO public."user"
          ("id", "name", "email", "email_verified", "created_at", "updated_at")
         VALUES ($1, 'Migration Buyer', 'migration-buyer@example.test', true, now(), now())`,
        [userId],
      );
      await pool.query(
        `UPDATE public."user"
         SET "category_interests_onboarding_completed_at" = $2
         WHERE "id" = $1`,
        [userId, completedAt],
      );
      await pool.query(
        `INSERT INTO public.user_category_interest ("user_id", "category_id", "sort_order")
         VALUES ($1, $2, 0)`,
        [userId, categoryId],
      );

      await runMigrationsPerTransaction(pool);
      await expectFinalMigrationState(pool);

      const [profile, interests] = await Promise.all([
        pool.query<{ completed_at: Date }>(
          `SELECT "category_interests_onboarding_completed_at" AS completed_at
           FROM public.bid_user_profile
           WHERE "user_id" = $1`,
          [userId],
        ),
        pool.query<{ category_id: string }>(
          `SELECT "category_id"
           FROM public.user_category_interest
           WHERE "user_id" = $1`,
          [userId],
        ),
      ]);
      expect(profile.rows).toEqual([{ completed_at: completedAt }]);
      expect(interests.rows).toEqual([{ category_id: categoryId }]);
    });
  });

  it("preserves null completion and multiple interests through 0153 and its rollback", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, MAIN_0139_FOLDER_MILLIS);

      const userId = "migration-null-interest-user";
      await pool.query(
        `INSERT INTO public."user"
          ("id", "name", "email", "email_verified", "created_at", "updated_at")
         VALUES ($1, 'New Buyer', 'new-buyer@example.test', true, now(), now())`,
        [userId],
      );
      await pool.query(
        `INSERT INTO public.user_category_interest ("user_id", "category_id", "sort_order")
         VALUES
           ($1, 'c1000001-0000-4000-8000-000000000001', 0),
           ($1, 'c1000002-0000-4000-8000-000000000002', 1)`,
        [userId],
      );

      await runMigrationsPerTransactionThrough(pool, CONTRACT_0153_FOLDER_MILLIS);

      const contracted = await pool.query<{ completed_at: Date | null; category_id: string }>(
        `SELECT p."category_interests_onboarding_completed_at" AS completed_at,
                i."category_id"
         FROM public.bid_user_profile p
         JOIN public.user_category_interest i ON i."user_id" = p."user_id"
         WHERE p."user_id" = $1
         ORDER BY i."sort_order"`,
        [userId],
      );
      expect(contracted.rows).toEqual([
        { completed_at: null, category_id: "c1000001-0000-4000-8000-000000000001" },
        { completed_at: null, category_id: "c1000002-0000-4000-8000-000000000002" },
      ]);

      await executeMigrationSql(pool, "0153_rollback.sql");

      const [rolledBack, interestOwner] = await Promise.all([
        pool.query<{ completed_at: Date | null; category_id: string }>(
          `SELECT u."category_interests_onboarding_completed_at" AS completed_at,
                  i."category_id"
           FROM public."user" u
           JOIN public.user_category_interest i ON i."user_id" = u."id"
           WHERE u."id" = $1
           ORDER BY i."sort_order"`,
          [userId],
        ),
        pool.query<{ target_table: string }>(
          `SELECT confrelid::regclass::text AS target_table
           FROM pg_constraint
           WHERE conrelid = 'public.user_category_interest'::regclass
             AND conname = 'user_category_interest_user_id_fkey'`,
        ),
      ]);
      expect(rolledBack.rows).toEqual([
        { completed_at: null, category_id: "c1000001-0000-4000-8000-000000000001" },
        { completed_at: null, category_id: "c1000002-0000-4000-8000-000000000002" },
      ]);
      expect(interestOwner.rows).toEqual([{ target_table: '"user"' }]);
    });
  });

  it("backfills 0154 subject ids and enforces the staged foreign key", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, CONTRACT_0153_FOLDER_MILLIS);

      const userId = "migration-subject-user";
      const entityId = "e1000001-0000-4000-8000-000000000001";
      const lotId = "a1000001-0000-4000-8000-000000000001";
      const bidId = "b1000001-0000-4000-8000-000000000001";
      await pool.query(
        `INSERT INTO public."user"
          ("id", "name", "email", "email_verified", "created_at", "updated_at")
         VALUES ($1, 'Subject Buyer', 'subject-buyer@example.test', true, now(), now())`,
        [userId],
      );
      await pool.query(
        `INSERT INTO public.legal_entity
          ("id", "display_name", "kind", "subkind", "created_by_user_id")
         VALUES ($1, 'Subject Buyer', 'individual', 'private_collector', $2)`,
        [entityId, userId],
      );
      await pool.query(
        `INSERT INTO public.lot
          ("id", "seller_legal_entity_id", "title", "auction_type", "starting_price",
           "current_price", "start_time", "end_time")
         VALUES ($1, $2, 'Migration Lot', 'english', 100, 100, now(), now() + interval '1 day')`,
        [lotId, entityId],
      );
      await pool.query(
        `INSERT INTO public.bid
          ("id", "lot_id", "bidder_id", "buyer_legal_entity_id", "amount")
         VALUES ($1, $2, $3, $4, 110)`,
        [bidId, lotId, userId, entityId],
      );

      await runMigrationsPerTransactionThrough(pool, SUBJECT_0154_FOLDER_MILLIS);

      const [bid, constraint] = await Promise.all([
        pool.query<{ bidder_id: string; subject_id: string }>(
          "SELECT bidder_id, subject_id FROM public.bid WHERE id = $1",
          [bidId],
        ),
        pool.query<{ validated: boolean }>(
          `SELECT convalidated AS validated
           FROM pg_constraint
           WHERE conrelid = 'public.bid'::regclass
             AND conname = 'bid_subject_id_user_fk'`,
        ),
      ]);
      expect(bid.rows).toEqual([{ bidder_id: userId, subject_id: userId }]);
      expect(constraint.rows).toEqual([{ validated: false }]);
      await expect(
        pool.query(`UPDATE public.bid SET subject_id = 'missing-subject' WHERE id = $1`, [bidId]),
      ).rejects.toMatchObject({ code: "23503" });
    });
  });

  it("keeps PII purge executable after 0153 contraction and 0156 rollback", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, PII_REPAIR_0156_FOLDER_MILLIS);

      const userId = "migration-pii-user";
      await pool.query(
        `INSERT INTO public."user"
          ("id", "name", "email", "email_verified", "pending_new_email",
           "email_change_old_ok", "email_change_new_ok", "email_change_expires_at",
           "created_at", "updated_at")
         VALUES
          ($1, 'PII Buyer', 'pii-buyer@example.test', true, 'pending@example.test',
           true, true, now() + interval '1 day', now(), now())`,
        [userId],
      );

      await executeMigrationSql(pool, "0156_rollback.sql");
      await pool.query("SELECT public.user_pii_purge($1)", [userId]);

      const purged = await pool.query<{
        name: string;
        email: string;
        pending_new_email: string | null;
        email_change_old_ok: boolean;
        email_change_new_ok: boolean;
        email_change_expires_at: Date | null;
      }>(
        `SELECT name, email, pending_new_email, email_change_old_ok,
                email_change_new_ok, email_change_expires_at
         FROM public."user"
         WHERE id = $1`,
        [userId],
      );
      expect(purged.rows).toEqual([
        {
          name: "[deleted]",
          email: `deleted+${userId}@purged.invalid`,
          pending_new_email: null,
          email_change_old_ok: false,
          email_change_new_ok: false,
          email_change_expires_at: null,
        },
      ]);
    });
  });

  it("backfills the directory and enforces the 0160/0161 grant cutovers", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_DIRECTORY_0158_FOLDER_MILLIS);

      const userId = "migration-directory-user";
      await pool.query(
        `INSERT INTO public."user"
          ("id", "name", "email", "email_verified", "phone_number", "created_at", "updated_at")
         VALUES
          ($1, 'Directory Buyer', 'directory-buyer@example.test', true, '+447700900123',
           now(), now())`,
        [userId],
      );
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_app') THEN
            CREATE ROLE worker_app;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_app') THEN
            CREATE ROLE api_app;
          END IF;
        END
        $$;
        GRANT USAGE ON SCHEMA public TO worker_app, api_app;
        GRANT SELECT ON TABLE public."user" TO worker_app, api_app;
      `);

      await runMigrationsPerTransactionThrough(pool, DIRECTORY_0159_FOLDER_MILLIS);

      const directory = await pool.query<{
        subject_id: string;
        email: string;
        phone: string;
      }>(
        `SELECT subject_id, email, phone
         FROM public.bid_identity_directory
         WHERE subject_id = $1`,
        [userId],
      );
      expect(directory.rows).toEqual([
        {
          subject_id: userId,
          email: "directory-buyer@example.test",
          phone: "+447700900123",
        },
      ]);

      await applyApplicationRoleGrants(databaseUrl);
      const soakPrivileges = await pool.query<{
        worker_user_select: boolean;
        worker_user_update: boolean;
        api_user_select: boolean;
        api_user_insert: boolean;
      }>(
        `SELECT
           has_table_privilege('worker_app', 'public."user"', 'SELECT')
             AS worker_user_select,
           has_table_privilege('worker_app', 'public."user"', 'UPDATE')
             AS worker_user_update,
           has_table_privilege('api_app', 'public."user"', 'SELECT')
             AS api_user_select,
           has_table_privilege('api_app', 'public."user"', 'INSERT')
             AS api_user_insert`,
      );
      expect(soakPrivileges.rows).toEqual([
        {
          worker_user_select: true,
          worker_user_update: false,
          api_user_select: true,
          api_user_insert: false,
        },
      ]);

      await runMigrationsPerTransactionThrough(pool, WORKER_CUTOVER_0160_FOLDER_MILLIS);
      await applyApplicationRoleGrants(databaseUrl);
      const workerCutoverPrivileges = await pool.query<{
        worker_user_select: boolean;
        api_user_select: boolean;
      }>(
        `SELECT
           has_table_privilege('worker_app', 'public."user"', 'SELECT')
             AS worker_user_select,
           has_table_privilege('api_app', 'public."user"', 'SELECT')
             AS api_user_select`,
      );
      expect(workerCutoverPrivileges.rows).toEqual([
        { worker_user_select: false, api_user_select: true },
      ]);

      await runMigrationsPerTransaction(pool);
      await applyApplicationRoleGrants(databaseUrl);

      const privileges = await pool.query<{
        worker_user_select: boolean;
        api_user_select: boolean;
        worker_directory_dml: boolean;
        api_directory_select: boolean;
        api_directory_insert: boolean;
      }>(
        `SELECT
           has_table_privilege('worker_app', 'public."user"', 'SELECT')
             AS worker_user_select,
           has_table_privilege('api_app', 'public."user"', 'SELECT')
             AS api_user_select,
           has_table_privilege(
             'worker_app',
             'public.bid_identity_directory',
             'INSERT,SELECT,UPDATE,DELETE'
           ) AS worker_directory_dml,
           has_table_privilege('api_app', 'public.bid_identity_directory', 'SELECT')
             AS api_directory_select,
           has_table_privilege('api_app', 'public.bid_identity_directory', 'INSERT')
             AS api_directory_insert`,
      );
      expect(privileges.rows).toEqual([
        {
          worker_user_select: false,
          api_user_select: false,
          worker_directory_dml: true,
          api_directory_select: true,
          api_directory_insert: false,
        },
      ]);
    });
  });

  it("rejects divergent applied history before running renumbered migrations", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, MAIN_0139_FOLDER_MILLIS);
      await pool.query(
        `UPDATE drizzle.__drizzle_migrations
         SET hash = 'unsafe-feature-ordering'
         WHERE created_at = $1`,
        [RELEASED_0137_FOLDER_MILLIS],
      );

      await expect(runMigrationsPerTransaction(pool)).rejects.toThrow(
        `Migration history diverged at ${RELEASED_0137_FOLDER_MILLIS}`,
      );
    });
  });
});
