import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import { laterRollbackSql } from "./testing/later-rollbacks.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const TAG = "0405_shop_alert_send_log";
const journal = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../drizzle/meta/_journal.json"), "utf8"),
) as { entries: { tag: string; when: number }[] };
const at = journal.entries.findIndex((e) => e.tag === TAG);
/** The journal time of the migration before 0405, and of 0405 itself. */
const BEFORE = journal.entries[at - 1]?.when ?? 0;
const OWN = journal.entries[at]?.when ?? 0;

const rollbackSql = () =>
  readFile(resolve(import.meta.dirname, "../drizzle/0405_rollback.sql"), "utf8");

type Pool = { query: <R>(sql: string, values?: unknown[]) => Promise<{ rows: R[] }> };

const ARTIST = "00000000-0000-4000-8000-000000000405";
const EDITION = "00000000-0000-4000-8000-000000000451";
const ORIGINAL = "00000000-0000-4000-8000-000000000452";
const NEITHER = "00000000-0000-4000-8000-000000000453";

async function seed(pool: Pool) {
  await pool.query(`
    begin;
    set local session_replication_role = replica;
    insert into shop_artwork (id, slug, title, artist_id, eligible_for_edition_allocation, import_key, sales_channel)
    values ('${EDITION}', 'e-0405', 'Edition', '${ARTIST}', true, 'k-0405-e', 'shop'),
           ('${ORIGINAL}', 'o-0405', 'Original', '${ARTIST}', false, 'k-0405-o', 'art'),
           ('${NEITHER}', 'n-0405', 'Neither', '${ARTIST}', false, 'k-0405-n', 'shop');
    insert into shop_alert_announcement (item_key, announced_at, announce, expanded_at)
    values ('artwork:${EDITION}', '2026-11-01T10:00:00Z', true, '2026-11-01T11:00:00Z'),
           ('artwork:${ORIGINAL}', '2026-11-02T10:00:00Z', true, null),
           ('artwork:${NEITHER}', '2026-11-03T10:00:00Z', false, null);
    insert into shop_admin_audit (actor_subject_id, capability, action, target_type, target_id, created_at)
    values ('subject-first', 'catalogue.publish', 'publish_artwork', 'shop_artwork', '${EDITION}', '2026-11-01T10:00:00Z'),
           ('subject-later', 'catalogue.publish', 'publish_artwork', 'shop_artwork', '${EDITION}', '2026-11-05T10:00:00Z');
    commit;
  `);
}

async function announcements(pool: Pool) {
  return (
    await pool.query<Record<string, unknown>>(
      `select item_key, kind, announced_by, matched_count, emailed_count, dropped_count, dropped_reasons
         from shop_alert_announcement order by announced_at`,
    )
  ).rows;
}

const hasIndex = async (pool: Pool) =>
  (
    await pool.query<{ n: number }>(
      "select count(*)::int as n from pg_indexes where indexname = 'shop_alert_match_item_key_idx'",
    )
  ).rows[0]?.n === 1;

describe.skipIf(!url)("migration 0405 shop alert send log", { timeout: 180_000 }, () => {
  it("fills kind and publisher once, keeps old counters NULL, rolls back and applies again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE);
      await seed(pool);

      await runMigrationsPerTransaction(pool);

      expect(await announcements(pool)).toEqual([
        {
          item_key: `artwork:${EDITION}`,
          kind: "shop_release",
          // The publish at or before the announcement, not the later republish.
          announced_by: "subject-first",
          // Not kept before 0405: the log says so rather than passing off what is left.
          matched_count: null,
          emailed_count: null,
          dropped_count: null,
          dropped_reasons: null,
        },
        {
          item_key: `artwork:${ORIGINAL}`,
          kind: "art_original",
          announced_by: null,
          matched_count: null,
          emailed_count: null,
          dropped_count: null,
          dropped_reasons: null,
        },
        {
          item_key: `artwork:${NEITHER}`,
          kind: null,
          announced_by: null,
          matched_count: null,
          emailed_count: null,
          dropped_count: null,
          dropped_reasons: null,
        },
      ]);
      expect(await hasIndex(pool)).toBe(true);

      // A release announced from now on keeps its counts from zero.
      await pool.query(
        "insert into shop_alert_announcement (item_key, announce, kind) values ('artwork:new-0405', true, 'shop_release')",
      );
      const [fresh] = (
        await pool.query<Record<string, unknown>>(
          "select emailed_count, dropped_count, dropped_reasons from shop_alert_announcement where item_key = 'artwork:new-0405'",
        )
      ).rows;
      expect(fresh).toEqual({ emailed_count: 0, dropped_count: 0, dropped_reasons: {} });
      await expect(
        pool.query(
          "insert into shop_alert_announcement (item_key, announce, kind) values ('artwork:bad-0405', true, 'lot')",
        ),
      ).rejects.toThrow(/shop_alert_announcement_kind_check/);
      await expect(
        pool.query(
          "update shop_alert_announcement set emailed_count = -1 where item_key = 'artwork:new-0405'",
        ),
      ).rejects.toThrow(/shop_alert_announcement_counts_check/);

      await pool.query(laterRollbackSql(405));
      await pool.query(await rollbackSql());

      const left = await pool.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_name = 'shop_alert_announcement'
            and column_name in ('kind', 'announced_by', 'matched_count', 'emailed_count', 'dropped_count', 'dropped_reasons')`,
      );
      expect(left.rows).toEqual([]);
      expect(await hasIndex(pool)).toBe(false);
      const ledger = await pool.query(
        `select 1 from drizzle.__drizzle_migrations where created_at = ${OWN}`,
      );
      expect(ledger.rows).toHaveLength(0);
      // The announcements themselves are kept.
      const kept = await pool.query<{ n: number }>(
        "select count(*)::int as n from shop_alert_announcement",
      );
      expect(kept.rows[0]?.n).toBe(4);

      await runMigrationsPerTransaction(pool);
      expect((await announcements(pool))[0]).toMatchObject({
        kind: "shop_release",
        announced_by: "subject-first",
      });
    });
  });
});
