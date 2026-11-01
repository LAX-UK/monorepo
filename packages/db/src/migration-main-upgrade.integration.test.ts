import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { applyApplicationRoleGrants, ensureApplicationRolesExist } from "./migrate-roles.js";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import {
  migrationTestDatabaseUrl as migrationUrl,
  withTemporaryDatabase,
} from "./testing/temporary-database.js";

const RELEASED_0137_FOLDER_MILLIS = 1788000013000;
const MAIN_0139_FOLDER_MILLIS = 1788000015000;
const CONTRACT_0153_FOLDER_MILLIS = 1788000029000;
const SUBJECT_0154_FOLDER_MILLIS = 1788000030000;
const PII_REPAIR_0156_FOLDER_MILLIS = 1788000032000;
const BEFORE_DIRECTORY_0158_FOLDER_MILLIS = 1788000034000;
const DIRECTORY_0159_FOLDER_MILLIS = 1788000035000;
const WORKER_CUTOVER_0160_FOLDER_MILLIS = 1788000036000;
const BEFORE_ADDRESS_BOOK_FOLDER_MILLIS = 1794643200000;
const DECLINE_REASON_0232_FOLDER_MILLIS = 1795420800000;
const FINAL_FOLDER_MILLIS = 1798444800000;
const ATG_SYNC_LINKS_FOLDER_MILLIS = 1788000007500;

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

  it("copies Bid addresses into the identity address book, keeps defaults and scrubs them on purge", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_ADDRESS_BOOK_FOLDER_MILLIS);

      const insertUser = (id: string, name: string, email: string) =>
        pool.query(
          `INSERT INTO public."user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
           VALUES ($1, $2, $3, true, now(), now())`,
          [id, name, email],
        );
      await insertUser("addr-ann", "Ann Buyer", "ann@example.test");
      await insertUser("addr-bob", "Bob Buyer", "bob@example.test");
      await insertUser("addr-gone", "[deleted]", "deleted+addr-gone@purged.invalid");

      const insertAddress = (
        id: string,
        userId: string,
        country: string,
        type: string,
        isDefault: boolean,
        createdAt: string,
      ) =>
        pool.query(
          `INSERT INTO public.user_address
            ("id", "user_id", "label", "line1", "city", "postal_code", "country", "address_type", "is_default", "created_at")
           VALUES ($1, $2, 'Home', '1 High Street', 'London', 'SW1A 1AA', $3, $4, $5, $6)`,
          [id, userId, country, type, isDefault, createdAt],
        );
      const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
      // Ann: an older and a newer default of type "both" (the newest must win), plus a billing-only one.
      await insertAddress(id(1), "addr-ann", "gb", "both", true, "2026-01-01T00:00:00Z");
      await insertAddress(
        id(2),
        "addr-ann",
        "United Kingdom",
        "both",
        true,
        "2026-02-01T00:00:00Z",
      );
      await insertAddress(id(3), "addr-ann", "FR", "billing", false, "2026-03-01T00:00:00Z");
      // Bob: a shipping-only default and a country that needs the script (free-text name).
      await insertAddress(id(4), "addr-bob", "US", "shipping", true, "2026-01-01T00:00:00Z");
      await insertAddress(id(5), "addr-bob", "Ruritania", "both", false, "2026-01-02T00:00:00Z");
      await insertAddress(id(6), "addr-gone", "GB", "both", true, "2026-01-01T00:00:00Z");

      await runMigrationsPerTransaction(pool);

      const copied = await pool.query(
        `SELECT id, subject_id, recipient_name, country, is_default_shipping, is_default_billing, version
         FROM public.identity_address ORDER BY id`,
      );
      expect(copied.rows).toEqual([
        {
          id: id(1),
          subject_id: "addr-ann",
          recipient_name: "Ann Buyer",
          country: "GB",
          is_default_shipping: false,
          is_default_billing: false,
          version: 1,
        },
        {
          id: id(2),
          subject_id: "addr-ann",
          recipient_name: "Ann Buyer",
          country: "GB",
          is_default_shipping: true,
          is_default_billing: true,
          version: 1,
        },
        {
          id: id(3),
          subject_id: "addr-ann",
          recipient_name: "Ann Buyer",
          country: "FR",
          is_default_shipping: false,
          is_default_billing: false,
          version: 1,
        },
        {
          id: id(4),
          subject_id: "addr-bob",
          recipient_name: "Bob Buyer",
          country: "US",
          is_default_shipping: true,
          is_default_billing: false,
          version: 1,
        },
      ]);

      // Re-applying the copy adds nothing and never disturbs defaults.
      const sql = await readFile(
        resolve(import.meta.dirname, "../drizzle/0224_identity_address_book.sql"),
        "utf8",
      );
      await pool.query(
        sql
          .replaceAll("--> statement-breakpoint", "")
          .replace("SET LOCAL lock_timeout = '30s';", ""),
      );
      const again = await pool.query("SELECT count(*)::int AS n FROM public.identity_address");
      expect(again.rows[0]?.n).toBe(4);

      await expect(
        pool.query("UPDATE public.identity_address SET is_default_shipping = true WHERE id = $1", [
          id(1),
        ]),
      ).rejects.toMatchObject({ code: "23505" });

      await pool.query("SELECT public.user_pii_purge($1)", ["addr-ann"]);
      const left = await pool.query("SELECT subject_id FROM public.identity_address ORDER BY id");
      expect(left.rows).toEqual([{ subject_id: "addr-bob" }]);

      await executeMigrationSql(pool, "0224_rollback.sql");
      const table = await pool.query(`SELECT to_regclass('public.identity_address') AS t`);
      expect(table.rows[0]?.t).toBeNull();
      const legacy = await pool.query("SELECT count(*)::int AS n FROM public.user_address");
      expect(legacy.rows[0]?.n).toBe(6);
    });
  });

  it("erases sign-in material, phone and tokens on purge, keeps the anonymised user row, and rolls back", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);

      const purged = "0b6f5c1e-4d2a-4f8e-9a31-7c5d8e2b6a10";
      const bystander = "5e9d3a74-1b86-4c20-8f7d-2a6c4b9e1d53";
      const clientId = "7a1c9e32-6d54-4b08-a2f1-3e8b5c7d9014";
      const insertUser = (id: string, email: string, phone: string) =>
        pool.query(
          `INSERT INTO public."user"
            ("id", "name", "email", "email_verified", "phone_number", "phone_number_verified",
             "pending_new_email", "two_factor_enabled", "created_at", "updated_at")
           VALUES ($1, 'Real Name', $2, true, $3, true, $4, true, now(), now())`,
          [id, email, phone, `new-${email}`],
        );
      await insertUser(purged, "purge-me@example.test", "+447700900111");
      await insertUser(bystander, "keep-me@example.test", "+447700900222");

      await pool.query(
        `INSERT INTO public.oauth_application
          ("id", "name", "client_id", "redirect_urls", "type", "created_at", "updated_at")
         VALUES ($1, 'Test client', $1, 'https://client.example.test/cb', 'web', now(), now())`,
        [clientId],
      );
      for (const userId of [purged, bystander]) {
        await pool.query(
          `INSERT INTO public.session ("id", "expires_at", "token", "created_at", "updated_at", "user_id")
           VALUES ($1, now() + interval '1 day', $2, now(), now(), $3)`,
          [`session-${userId}`, `token-${userId}`, userId],
        );
        await pool.query(
          `INSERT INTO public.account
            ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
           VALUES ($1, $2, 'credential', $2, 'scrypt-hash', now(), now())`,
          [`account-${userId}`, userId],
        );
        await pool.query(
          `INSERT INTO public.two_factor ("id", "secret", "backup_codes", "user_id")
           VALUES ($1, 'secret', 'codes', $2)`,
          [`two-factor-${userId}`, userId],
        );
        await pool.query(
          `INSERT INTO public.oauth_access_token
            ("id", "access_token", "refresh_token", "access_token_expires_at",
             "refresh_token_expires_at", "client_id", "user_id", "scopes", "created_at", "updated_at")
           VALUES ($1, $2, $3, now() + interval '1 hour', now() + interval '1 day', $4, $5,
                   'openid', now(), now())`,
          [`access-${userId}`, `at-${userId}`, `rt-${userId}`, clientId, userId],
        );
        await pool.query(
          `INSERT INTO public.oauth_consent
            ("id", "client_id", "user_id", "scopes", "consent_given", "created_at", "updated_at")
           VALUES ($1, $2, $3, 'openid', true, now(), now())`,
          [`consent-${userId}`, clientId, userId],
        );
        await pool.query(
          `INSERT INTO public.auth_known_device ("user_id", "fingerprint") VALUES ($1, 'device')`,
          [userId],
        );
      }
      await pool.query(
        `INSERT INTO public.verification ("id", "identifier", "value", "expires_at")
         VALUES ('verification-email', 'purge-me@example.test', 'otp', now() + interval '1 day'),
                ('verification-reset', 'reset-password:one-time', $1, now() + interval '1 day'),
                ('verification-other', 'keep-me@example.test', 'otp', now() + interval '1 day')`,
        [purged],
      );

      const countFor = async (table: string, userId: string) =>
        Number(
          (
            await pool.query(
              `SELECT count(*)::int AS n FROM public."${table}" WHERE user_id = $1`,
              [userId],
            )
          ).rows[0]?.n,
        );
      const personalTables = [
        "session",
        "account",
        "two_factor",
        "oauth_access_token",
        "oauth_consent",
        "auth_known_device",
      ];

      await pool.query("SELECT public.user_pii_purge($1)", [purged]);

      for (const table of personalTables) {
        expect(await countFor(table, purged), `${table} cleared for the purged user`).toBe(0);
        expect(await countFor(table, bystander), `${table} kept for others`).toBe(1);
      }
      const verification = await pool.query("SELECT id FROM public.verification ORDER BY id");
      expect(verification.rows).toEqual([{ id: "verification-other" }]);

      const user = await pool.query(
        `SELECT name, email, phone_number, phone_number_verified, pending_new_email,
                two_factor_enabled, image
         FROM public."user" WHERE id = $1`,
        [purged],
      );
      expect(user.rows).toEqual([
        {
          name: "[deleted]",
          email: `deleted+${purged}@purged.invalid`,
          phone_number: null,
          phone_number_verified: false,
          pending_new_email: null,
          two_factor_enabled: false,
          image: null,
        },
      ]);
      const other = await pool.query(`SELECT name, phone_number FROM public."user" WHERE id = $1`, [
        bystander,
      ]);
      expect(other.rows[0]?.name).toBe("Real Name");
      expect(other.rows[0]?.phone_number).not.toBeNull();

      // The previous function stays available as a rollback and leaves credentials alone.
      await executeMigrationSql(pool, "0226_rollback.sql");
      await pool.query("SELECT public.user_pii_purge($1)", [bystander]);
      expect(await countFor("session", bystander)).toBe(1);
    });
  });

  it("creates each tool's saved views table with one view name per person and list, and rolls back", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);

      const owner = "3c8e5a1d-7b24-4f96-a0e3-9d1b6c2f4a78";
      for (const table of ["admin_saved_view", "shop_staff_saved_view"]) {
        const insert = (subject: string, listKey: string, label: string) =>
          pool.query(
            `INSERT INTO public."${table}" ("owner_subject_id", "list_key", "label", "query")
             VALUES ($1, $2, $3, 'status=paid')`,
            [subject, listKey, label],
          );
        await insert(owner, "test.orders", "Paid");
        // The same name is fine for another list or another person, not twice in one list.
        await insert(owner, "test.staff", "Paid");
        await insert("someone-else", "test.orders", "Paid");
        await expect(insert(owner, "test.orders", "Paid")).rejects.toMatchObject({ code: "23505" });

        const row = await pool.query<{ position: number }>(
          `SELECT position FROM public."${table}" WHERE owner_subject_id = $1 AND list_key = 'test.orders'`,
          [owner],
        );
        expect(row.rows).toEqual([{ position: 0 }]);
        const index = await pool.query(
          `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1
             AND indexname = $2`,
          [table, `${table}_owner_list_idx`],
        );
        expect(index.rowCount).toBe(1);
      }

      await executeMigrationSql(pool, "0227_rollback.sql");
      const tables = await pool.query(
        `SELECT to_regclass('public.admin_saved_view') AS admin,
                to_regclass('public.shop_staff_saved_view') AS shop`,
      );
      expect(tables.rows[0]).toEqual({ admin: null, shop: null });
    });
  });

  it("adds artwork publishing and archiving, publishes inserts by default, and rolls back", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);

      const party = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_party (display_name) VALUES ('Migration Artist') RETURNING id",
      );
      const artist = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_artist (party_id, slug) VALUES ($1, 'migration-artist') RETURNING id",
        [party.rows[0]?.id],
      );
      const artwork = await pool.query<{ published: boolean; archived: boolean }>(
        "INSERT INTO public.shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, import_key) VALUES ('migration-work', 'Work', $1, false, 'migration:work') RETURNING published_at IS NOT NULL AS published, archived_at IS NOT NULL AS archived",
        [artist.rows[0]?.id],
      );
      // Imports and seeds insert without the column, so they keep publishing as before.
      expect(artwork.rows[0]).toEqual({ published: true, archived: false });
      const artistArchived = await pool.query(
        "SELECT archived_at FROM public.shop_artist WHERE id = $1",
        [artist.rows[0]?.id],
      );
      expect(artistArchived.rows[0]).toEqual({ archived_at: null });

      await executeMigrationSql(pool, "0228_rollback.sql");
      const columns = await pool.query(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('published_at', 'archived_at') AND table_name IN ('shop_artwork', 'shop_artist')",
      );
      expect(columns.rows).toEqual([]);
    });
  });

  it("links an edition to its source original, clears the link when the original goes, and rolls back", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);

      const party = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_party (display_name) VALUES ('Source Artist') RETURNING id",
      );
      const artist = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_artist (party_id, slug) VALUES ($1, 'source-artist') RETURNING id",
        [party.rows[0]?.id],
      );
      const artistId = artist.rows[0]?.id;
      const original = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, sales_channel, import_key) VALUES ('source-original', 'Original', $1, false, 'art', 'migration:source-original') RETURNING id",
        [artistId],
      );
      const originalId = original.rows[0]?.id;
      const edition = await pool.query<{ id: string; source_original_artwork_id: string | null }>(
        "INSERT INTO public.shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, import_key, source_original_artwork_id) VALUES ('source-edition', 'Edition', $1, true, 'migration:source-edition', $2) RETURNING id, source_original_artwork_id",
        [artistId, originalId],
      );
      expect(edition.rows[0]?.source_original_artwork_id).toBe(originalId);

      // An artwork cannot be its own source.
      await expect(
        pool.query(
          "UPDATE public.shop_artwork SET source_original_artwork_id = id WHERE slug = 'source-edition'",
        ),
      ).rejects.toThrow(/shop_artwork_source_original_not_self/);

      // Removing the original clears the link instead of blocking the delete.
      await pool.query("DELETE FROM public.shop_artwork WHERE id = $1", [originalId]);
      const cleared = await pool.query(
        "SELECT source_original_artwork_id FROM public.shop_artwork WHERE slug = 'source-edition'",
      );
      expect(cleared.rows[0]).toEqual({ source_original_artwork_id: null });

      await executeMigrationSql(pool, "0230_rollback.sql");
      const columns = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_artwork' AND column_name = 'source_original_artwork_id'",
      );
      expect(columns.rows).toEqual([]);
    });
  });

  it("keeps one waiting edition alert per email or account, allows a new one after it ends, and rolls back", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);

      const party = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_party (display_name) VALUES ('Alert Artist') RETURNING id",
      );
      const artist = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_artist (party_id, slug) VALUES ($1, 'alert-artist') RETURNING id",
        [party.rows[0]?.id],
      );
      const artwork = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, import_key) VALUES ('alert-edition', 'Edition', $1, true, 'migration:alert-edition') RETURNING id",
        [artist.rows[0]?.id],
      );
      const artworkId = artwork.rows[0]?.id;
      const insertAlert = (email: string | null, subject: string | null) =>
        pool.query<{ id: string }>(
          "INSERT INTO public.shop_artwork_interest (artwork_id, intent, contact_email, identity_subject_id) VALUES ($1, 'notify_me', $2, $3) RETURNING id",
          [artworkId, email, subject],
        );

      const guest = await insertAlert("Collector@Example.test", null);
      // The same address in another case is the same person.
      await expect(insertAlert("collector@example.test", null)).rejects.toThrow(
        /shop_artwork_interest_alert_email_uid/,
      );
      await insertAlert("member@example.test", "subject-alert");
      await expect(insertAlert("other@example.test", "subject-alert")).rejects.toThrow(
        /shop_artwork_interest_alert_subject_uid/,
      );

      // A stopped alert no longer blocks a new one.
      await pool.query(
        "UPDATE public.shop_artwork_interest SET cancelled_at = now() WHERE id = $1",
        [guest.rows[0]?.id],
      );
      await insertAlert("collector@example.test", null);

      // Enquiries cannot carry alert state.
      await expect(
        pool.query(
          "INSERT INTO public.shop_artwork_interest (artwork_id, intent, identity_subject_id, cancelled_at) VALUES ($1, 'enquiry', 'subject-enquiry', now())",
          [artworkId],
        ),
      ).rejects.toThrow(/shop_artwork_interest_alert_columns_ck/);
      await pool.query(
        "INSERT INTO public.shop_artwork_interest (artwork_id, intent, identity_subject_id) VALUES ($1, 'enquiry', 'subject-enquiry')",
        [artworkId],
      );
      await expect(
        pool.query(
          "INSERT INTO public.shop_artwork_interest (artwork_id, intent, identity_subject_id) VALUES ($1, 'enquiry', 'subject-enquiry')",
          [artworkId],
        ),
      ).rejects.toThrow(/shop_artwork_interest_enquiry_subject_uid/);

      await executeMigrationSql(pool, "0231_rollback.sql");
      const columns = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_artwork_interest' AND column_name IN ('cancelled_at', 'unsubscribe_token_hash')",
      );
      expect(columns.rows).toEqual([]);
      const remaining = await pool.query<{ contact_email: string | null }>(
        "SELECT contact_email FROM public.shop_artwork_interest WHERE intent = 'notify_me' ORDER BY contact_email",
      );
      expect(remaining.rows.map((row) => row.contact_email)).toEqual([
        "collector@example.test",
        "member@example.test",
      ]);
    });
  });

  it("numbers existing orders by creation, issues new references once, dates fulfilment stages from the audit trail, and rolls back", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, DECLINE_REASON_0232_FOLDER_MILLIS);

      const insertOrder = (key: string, createdAt: string) =>
        pool.query<{ id: string }>(
          `INSERT INTO public.shop_order
            (identity_subject_id, fulfilment, merchandise_subtotal_pence, fulfilment_surcharge_pence,
             total_pence, idempotency_key, created_at)
           VALUES ('subject-ref', 'uk_insured_delivery', 1000, 0, 1000, $1, $2) RETURNING id`,
          [key, createdAt],
        );
      await insertOrder("ref-later", "2026-03-02T10:00:00Z");
      const earlier = await insertOrder("ref-earlier", "2026-03-01T10:00:00Z");
      const fulfilment = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_fulfilment (order_id, option, status) VALUES ($1, 'uk_insured_delivery', 'in_transit') RETURNING id",
        [earlier.rows[0]?.id],
      );
      const fulfilmentId = fulfilment.rows[0]?.id ?? "";
      for (const [status, at] of [
        ["in_production", "2026-03-03T09:00:00Z"],
        ["awaiting_dispatch", "2026-03-04T09:00:00Z"],
        ["in_transit", "2026-03-05T09:00:00Z"],
      ] as const) {
        await pool.query(
          `INSERT INTO public.shop_admin_audit
            (actor_subject_id, capability, action, target_type, target_id, after_json, created_at)
           VALUES ('staff', 'fulfilment.write', 'update_fulfilment', 'shop_fulfilment', $1, $2, $3)`,
          [fulfilmentId, JSON.stringify({ status }), at],
        );
      }

      await runMigrationsPerTransaction(pool);

      const numbered = await pool.query<{ idempotency_key: string; reference: string }>(
        "SELECT idempotency_key, reference FROM public.shop_order ORDER BY created_at",
      );
      expect(numbered.rows).toEqual([
        { idempotency_key: "ref-earlier", reference: "LAX-S-10001" },
        { idempotency_key: "ref-later", reference: "LAX-S-10002" },
      ]);

      const fresh = await insertOrder("ref-new", "2026-03-06T10:00:00Z");
      const freshRef = await pool.query<{ reference: string }>(
        "SELECT reference FROM public.shop_order WHERE id = $1",
        [fresh.rows[0]?.id],
      );
      expect(freshRef.rows[0]?.reference).toBe("LAX-S-10003");
      await expect(
        pool.query("UPDATE public.shop_order SET reference = 'LAX-S-10001' WHERE id = $1", [
          fresh.rows[0]?.id,
        ]),
      ).rejects.toThrow(/shop_order_reference_uid/);

      const stages = await pool.query<{
        production_started_at: Date | null;
        dispatched_at: Date | null;
        ready_for_collection_at: Date | null;
      }>(
        "SELECT production_started_at, dispatched_at, ready_for_collection_at FROM public.shop_fulfilment WHERE id = $1",
        [fulfilmentId],
      );
      expect(stages.rows[0]?.production_started_at?.toISOString()).toBe("2026-03-03T09:00:00.000Z");
      expect(stages.rows[0]?.dispatched_at?.toISOString()).toBe("2026-03-05T09:00:00.000Z");
      expect(stages.rows[0]?.ready_for_collection_at).toBeNull();

      await executeMigrationSql(pool, "0233_rollback.sql");
      const columns = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name = 'shop_order' AND column_name = 'reference') OR (table_name = 'shop_fulfilment' AND column_name IN ('production_started_at', 'dispatched_at', 'ready_for_collection_at', 'cancelled_at')))",
      );
      expect(columns.rows).toEqual([]);
      const sequence = await pool.query(
        "SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'shop_order_reference_seq'",
      );
      expect(sequence.rows).toEqual([]);
    });
  });

  it("numbers paid orders' invoices in payment order, corrects stored VAT, and issues invoice numbers without gaps under concurrent payments", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, DECLINE_REASON_0232_FOLDER_MILLIS);

      const insertOrder = (key: string, paidAt: string | null) =>
        pool.query<{ id: string }>(
          `INSERT INTO public.shop_order
            (identity_subject_id, fulfilment, merchandise_subtotal_pence, fulfilment_surcharge_pence,
             total_pence, idempotency_key, status, paid_at)
           VALUES ('subject-inv', 'uk_insured_delivery', 12000, 1500, 13500, $1, $2, $3) RETURNING id`,
          [key, paidAt ? "paid" : "pending_payment", paidAt],
        );
      await insertOrder("inv-later", "2026-03-05T10:00:00Z");
      const paidEarlier = await insertOrder("inv-earlier", "2026-03-02T10:00:00Z");
      const unpaid = await insertOrder("inv-unpaid", null);
      const party = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_party (display_name) VALUES ('Invoice Artist') RETURNING id",
      );
      const artist = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_artist (party_id, slug) VALUES ($1, 'invoice-artist') RETURNING id",
        [party.rows[0]?.id],
      );
      const artwork = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_artwork (slug, title, artist_id, eligible_for_edition_allocation, import_key) VALUES ('invoice-edition', 'Edition', $1, true, 'migration:invoice-edition') RETURNING id",
        [artist.rows[0]?.id],
      );
      const edition = await pool.query<{ id: string }>(
        "INSERT INTO public.shop_edition (artwork_id, edition_number, allocation) VALUES ($1, 1, 'lax') RETURNING id",
        [artwork.rows[0]?.id],
      );
      // Written before the fix: 20% of the VAT-inclusive price.
      await pool.query(
        `INSERT INTO public.shop_order_line (order_id, edition_id, artwork_id, unit_price_pence, vat_treatment, vat_rate_bp, vat_pence, edition_number)
         VALUES ($1, $2, $3, 12000, 'standard', 2000, 2400, 1)`,
        [paidEarlier.rows[0]?.id, edition.rows[0]?.id, artwork.rows[0]?.id],
      );

      await runMigrationsPerTransaction(pool);

      const numbered = await pool.query<{ idempotency_key: string; invoice_number: string | null }>(
        "SELECT idempotency_key, invoice_number FROM public.shop_order ORDER BY idempotency_key",
      );
      expect(numbered.rows).toEqual([
        { idempotency_key: "inv-earlier", invoice_number: "LAX-INV-000001" },
        { idempotency_key: "inv-later", invoice_number: "LAX-INV-000002" },
        { idempotency_key: "inv-unpaid", invoice_number: null },
      ]);

      const vat = await pool.query<{ vat_pence: number; fulfilment_vat_pence: number | null }>(
        `SELECT l.vat_pence, o.fulfilment_vat_pence FROM public.shop_order_line l
         JOIN public.shop_order o ON o.id = l.order_id WHERE o.id = $1`,
        [paidEarlier.rows[0]?.id],
      );
      expect(vat.rows).toEqual([{ vat_pence: 2000, fulfilment_vat_pence: 250 }]);

      // Two payments at once: the second waits for the first's counter lock and takes the next
      // number; a payment that rolls back gives its number back.
      const unpaidId = unpaid.rows[0]?.id;
      const second = await insertOrder("inv-second", null);
      const third = await insertOrder("inv-third", null);
      const a = await pool.connect();
      const b = await pool.connect();
      try {
        await a.query("BEGIN");
        await a.query(
          "UPDATE public.shop_order SET paid_at = now(), status = 'paid' WHERE id = $1",
          [unpaidId],
        );
        await b.query("BEGIN");
        const waiting = b.query(
          "UPDATE public.shop_order SET paid_at = now(), status = 'paid' WHERE id = $1",
          [second.rows[0]?.id],
        );
        await a.query("ROLLBACK");
        await waiting;
        await b.query("COMMIT");
      } finally {
        a.release();
        b.release();
      }
      await pool.query(
        "UPDATE public.shop_order SET paid_at = now(), status = 'paid' WHERE id = $1",
        [third.rows[0]?.id],
      );
      const issued = await pool.query<{ idempotency_key: string; invoice_number: string | null }>(
        "SELECT idempotency_key, invoice_number FROM public.shop_order WHERE idempotency_key IN ('inv-unpaid', 'inv-second', 'inv-third') ORDER BY idempotency_key",
      );
      expect(issued.rows).toEqual([
        { idempotency_key: "inv-second", invoice_number: "LAX-INV-000003" },
        { idempotency_key: "inv-third", invoice_number: "LAX-INV-000004" },
        { idempotency_key: "inv-unpaid", invoice_number: null },
      ]);
      // Paying again never renumbers an invoice.
      await pool.query("UPDATE public.shop_order SET paid_at = now() WHERE id = $1", [
        third.rows[0]?.id,
      ]);
      const kept = await pool.query<{ invoice_number: string }>(
        "SELECT invoice_number FROM public.shop_order WHERE id = $1",
        [third.rows[0]?.id],
      );
      expect(kept.rows[0]?.invoice_number).toBe("LAX-INV-000004");

      await executeMigrationSql(pool, "0233_rollback.sql");
      const leftover = await pool.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_invoice_counter'",
      );
      expect(leftover.rows).toEqual([]);
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
      const roleClient = await pool.connect();
      try {
        await ensureApplicationRolesExist(databaseUrl, roleClient, ["worker_app", "api_app"]);
        await roleClient.query(`
          GRANT USAGE ON SCHEMA public TO worker_app, api_app;
          GRANT SELECT ON TABLE public."user" TO worker_app, api_app;
        `);
      } finally {
        roleClient.release();
      }

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

  describe("late-registered ATG sync links (0131a)", () => {
    async function atgTableNames(pool: pg.Pool): Promise<string[]> {
      const tables = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN ('atg_auction_link', 'atg_lot_link')
         ORDER BY table_name`,
      );
      return tables.rows.map((row) => row.table_name);
    }

    async function ledgerHashAt(pool: pg.Pool, folderMillis: number): Promise<string[]> {
      const rows = await pool.query<{ hash: string }>(
        "SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at = $1",
        [folderMillis],
      );
      return rows.rows.map((row) => row.hash);
    }

    async function expectedHash(): Promise<string> {
      const sql = await readFile(
        resolve(import.meta.dirname, "../drizzle/0131a_atg_sync_links.sql"),
        "utf8",
      );
      return createHash("sha256").update(sql).digest("hex");
    }

    /** A main environment migrated before 0131a existed: later rows, no ATG row, no tables. */
    async function simulateEnvironmentWithoutAtgRow(pool: pg.Pool): Promise<void> {
      await pool.query("DROP TABLE IF EXISTS atg_lot_link, atg_auction_link");
      await pool.query("DELETE FROM drizzle.__drizzle_migrations WHERE created_at = $1", [
        ATG_SYNC_LINKS_FOLDER_MILLIS,
      ]);
    }

    it("creates the tables and records the release hash on a clean database", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        expect(await atgTableNames(pool)).toEqual(["atg_auction_link", "atg_lot_link"]);
        expect(await ledgerHashAt(pool, ATG_SYNC_LINKS_FOLDER_MILLIS)).toEqual([
          await expectedHash(),
        ]);
      });
    });

    it("backfills an environment already past its stamp instead of failing", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        await simulateEnvironmentWithoutAtgRow(pool);

        await runMigrationsPerTransaction(pool);

        expect(await atgTableNames(pool)).toEqual(["atg_auction_link", "atg_lot_link"]);
        expect(await ledgerHashAt(pool, ATG_SYNC_LINKS_FOLDER_MILLIS)).toEqual([
          await expectedHash(),
        ]);
        const head = await pool.query<{ created_at: string }>(
          "SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
        );
        expect(Number(head.rows[0]?.created_at)).toBe(FINAL_FOLDER_MILLIS);

        await runMigrationsPerTransaction(pool);
        const rows = await pool.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations",
        );
        const journal = JSON.parse(
          await readFile(resolve(import.meta.dirname, "../drizzle/meta/_journal.json"), "utf8"),
        ) as { entries: unknown[] };
        expect(Number(rows.rows[0]?.count)).toBe(journal.entries.length);
      });
    });

    it("adopts a production ledger that already holds the release row", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransactionThrough(pool, 1788000007000);
        // Production applied the release migration, so it has its tables as well as the row.
        await executeMigrationSql(pool, "0131a_atg_sync_links.sql");
        await pool.query(
          'INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)',
          [await expectedHash(), ATG_SYNC_LINKS_FOLDER_MILLIS],
        );
        await runMigrationsPerTransaction(pool);
        expect(await ledgerHashAt(pool, ATG_SYNC_LINKS_FOLDER_MILLIS)).toHaveLength(1);
      });
    });

    it("still rejects a divergent row at the ATG stamp", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        await pool.query(
          "UPDATE drizzle.__drizzle_migrations SET hash = 'other' WHERE created_at = $1",
          [ATG_SYNC_LINKS_FOLDER_MILLIS],
        );
        await expect(runMigrationsPerTransaction(pool)).rejects.toThrow(
          `Migration history diverged at ${ATG_SYNC_LINKS_FOLDER_MILLIS}`,
        );
      });
    });

    it("rolls back and re-applies cleanly", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        await executeMigrationSql(pool, "0131a_rollback.sql");
        expect(await atgTableNames(pool)).toEqual([]);
        await executeMigrationSql(pool, "0131a_atg_sync_links.sql");
        await executeMigrationSql(pool, "0131a_atg_sync_links.sql");
        expect(await atgTableNames(pool)).toEqual(["atg_auction_link", "atg_lot_link"]);
      });
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
