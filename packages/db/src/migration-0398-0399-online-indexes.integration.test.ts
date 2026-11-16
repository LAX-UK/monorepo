import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import { laterRollbackSql } from "./testing/later-rollbacks.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
/** The journal time of 0397, the migration before 0398. */
const THROUGH_0397 = 1812542400000;
const WHEN_0398 = 1812628800000;
const WHEN_0399 = 1812715200000;
const EVENT = "payment.unapplied_money_received";
const INDEXES = [
  "domain_events_event_type_aggregate_id_idx",
  "domain_events_unapplied_money_session_idx",
  "domain_events_unapplied_money_intent_idx",
];

const drizzleFile = (name: string) =>
  readFile(resolve(import.meta.dirname, "../drizzle", name), "utf8");

async function seed(pool: pg.Pool): Promise<void> {
  // Enough unapplied-money events that a seek beats walking them, as in production.
  await pool.query(
    `insert into domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
     select 'payment', g::text, $1,
            jsonb_build_object('dedupeKey', 'k' || g, 'shopCheckoutSessionId', 'cs_' || g,
                               'stripePaymentIntentId', 'pi_' || g),
            'migration-test'
       from generate_series(1, 2000) g`,
    [EVENT],
  );
  await pool.query(
    `insert into domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
     select 'payment', (g % 500)::text, 'type_' || (g % 20), '{}'::jsonb, 'migration-test'
       from generate_series(1, 20000) g`,
  );
  await pool.query("analyze domain_events");
}

async function validIndexes(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query<{ name: string }>(
    `select c.relname as name from pg_index i join pg_class c on c.oid = i.indexrelid
      where c.relname = any($1) and i.indisvalid order by 1`,
    [INDEXES],
  );
  return rows.map((r) => r.name);
}

async function ledger(pool: pg.Pool): Promise<number[]> {
  const { rows } = await pool.query<{ created_at: string }>(
    "select created_at from drizzle.__drizzle_migrations where created_at = any($1) order by 1",
    [[WHEN_0398, WHEN_0399]],
  );
  return rows.map((r) => Number(r.created_at));
}

async function grants(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query<{ g: string }>(
    `select grantee || ':' || privilege_type as g from information_schema.role_table_grants
      where table_name = 'domain_events' order by 1`,
  );
  return rows.map((r) => r.g);
}

/** Index names the plan touches, with sequential scans switched off so tiny tables still seek. */
async function planIndexes(pool: pg.Pool, query: string, params: unknown[]): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local enable_seqscan = off");
    const { rows } = await client.query<{ "QUERY PLAN": unknown }>(
      `explain (format json) ${query}`,
      params,
    );
    await client.query("rollback");
    return JSON.stringify(rows[0]?.["QUERY PLAN"]);
  } finally {
    client.release();
  }
}

async function rollBack(pool: pg.Pool): Promise<void> {
  await pool.query(laterRollbackSql(399));
  await pool.query(await drizzleFile("0399_rollback.sql"));
  await pool.query(laterRollbackSql(398));
  await pool.query(await drizzleFile("0398_rollback.sql"));
}

describe.skipIf(!url)(
  "migrations 0398 and 0399 domain_events lookup indexes",
  { timeout: 180_000 },
  () => {
    it("builds under a SHARE lock only, serves the lookups, leaves grants alone, rolls back and applies again", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransactionThrough(pool, THROUGH_0397);
        await seed(pool);
        const grantsBefore = await grants(pool);

        // The lock each migration holds on domain_events while it builds: SHARE (writers wait,
        // readers carry on), never ACCESS EXCLUSIVE.
        for (const tag of [
          "0398_domain_events_event_type_aggregate_idx",
          "0399_unapplied_money_shop_payment_idx",
        ]) {
          const client = await pool.connect();
          try {
            await client.query("begin");
            for (const stmt of (await drizzleFile(`${tag}.sql`)).split(
              "--> statement-breakpoint",
            )) {
              if (stmt.trim()) await client.query(stmt);
            }
            const { rows } = await client.query<{ mode: string }>(
              `select l.mode from pg_locks l where l.pid = pg_backend_pid()
               and l.relation = 'domain_events'::regclass order by 1`,
            );
            expect(rows.map((r) => r.mode)).toEqual(["ShareLock"]);
            await client.query("rollback");
          } finally {
            client.release();
          }
        }

        await runMigrationsPerTransaction(pool);
        expect(await validIndexes(pool)).toEqual([...INDEXES].sort());
        expect(await ledger(pool)).toEqual([WHEN_0398, WHEN_0399]);
        expect(await grants(pool)).toEqual(grantsBefore);

        const byType = await planIndexes(
          pool,
          "select occurred_at from domain_events where event_type = $1 and aggregate_id = $2",
          ["type_3", "3"],
        );
        expect(byType).toContain("domain_events_event_type_aggregate_id_idx");
        // existsForShopPayment's predicate, as the Drizzle reader writes it.
        const shopPayment = await planIndexes(
          pool,
          `select id from domain_events where event_type = $1
           and ((payload->>'shopCheckoutSessionId') = $2 or (payload->>'stripePaymentIntentId') = $3)
         limit 1`,
          [EVENT, "cs_42", "pi_43"],
        );
        expect(shopPayment).toContain("domain_events_unapplied_money_session_idx");
        expect(shopPayment).toContain("domain_events_unapplied_money_intent_idx");
        expect(shopPayment).toContain("BitmapOr");

        await rollBack(pool);
        expect(await validIndexes(pool)).toEqual([]);
        expect(await ledger(pool)).toEqual([]);

        await runMigrationsPerTransaction(pool);
        expect(await validIndexes(pool)).toEqual([...INDEXES].sort());
        expect(await ledger(pool)).toEqual([WHEN_0398, WHEN_0399]);
      });
    });

    it("adopts indexes pre-built CONCURRENTLY and refuses an INVALID one from a failed build", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransactionThrough(pool, THROUGH_0397);
        await seed(pool);

        // A failed concurrent build (here: a unique build over duplicate values) leaves an INVALID
        // index under the name; the migration must stop rather than keep it.
        await expect(
          pool.query(
            `create unique index concurrently "domain_events_event_type_aggregate_id_idx"
             on domain_events (event_type)`,
          ),
        ).rejects.toThrow();
        await expect(runMigrationsPerTransaction(pool)).rejects.toThrow(/INVALID/);
        expect(await ledger(pool)).toEqual([]);

        // The documented out-of-band path: drop it, build every index concurrently, then migrate.
        await pool.query(
          `drop index concurrently if exists "domain_events_event_type_aggregate_id_idx"`,
        );
        for (const tag of [
          "0398_domain_events_event_type_aggregate_idx",
          "0399_unapplied_money_shop_payment_idx",
        ]) {
          const header = (await drizzleFile(`${tag}.sql`)).split("\n");
          const statements: string[] = [];
          for (const line of header) {
            if (line.startsWith("--   CREATE INDEX CONCURRENTLY")) statements.push("");
            if (statements.length > 0 && line.startsWith("--   ")) {
              statements[statements.length - 1] += `${line.slice(5)}\n`;
            }
            if (statements.length > 0 && !line.startsWith("--   ")) break;
          }
          expect(statements.length).toBeGreaterThan(0);
          for (const stmt of statements) await pool.query(stmt);
        }
        expect(await validIndexes(pool)).toEqual([...INDEXES].sort());

        await runMigrationsPerTransaction(pool);
        expect(await validIndexes(pool)).toEqual([...INDEXES].sort());
        expect(await ledger(pool)).toEqual([WHEN_0398, WHEN_0399]);
      });
    });
  },
);
