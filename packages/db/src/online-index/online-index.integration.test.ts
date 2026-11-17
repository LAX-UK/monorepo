import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "../migrate-runner.js";
import { buildPgConnectionConfig } from "../ssl.js";
import { withTemporaryDatabase } from "../testing/temporary-database.js";
import {
  ONLINE_INDEX_APPLICATION_NAME,
  OnlineIndexBuildError,
  type OnlineIndexClient,
  parseOnlineIndexDeclaration,
  runOnlineIndexStep,
  runPendingOnlineIndexBuilds,
} from "./index.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
/** The journal time of 0398, the migration before 0399. */
const THROUGH_0398 = 1812628800000;
const WHEN_0399 = 1812715200000;
const WHEN_0400 = 1812801600000;
const INDEXES = [
  "domain_events_event_type_aggregate_id_idx",
  "domain_events_unapplied_money_intent_idx",
  "domain_events_unapplied_money_session_idx",
];
const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
const MIGRATE_PROD_JS = resolve(PACKAGE_ROOT, "dist/migrate-prod.js");
const MIGRATE_JS = resolve(PACKAGE_ROOT, "dist/migrate.js");

type ScriptResult = { code: number; stdout: string; stderr: string };

/** Runs a built migrate script; ONLINE_INDEX_STEP is never inherited from the test process. */
function runScript(script: string, env: Record<string, string>): Promise<ScriptResult> {
  if (!existsSync(script)) {
    throw new Error("Build @auction/db first: pnpm --filter @auction/db build");
  }
  const { ONLINE_INDEX_STEP: _inherited, ...base } = process.env;
  return promisify(execFile)(process.execPath, [script], {
    cwd: PACKAGE_ROOT,
    env: { ...base, ...env },
  }).then(
    ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
    (error: ScriptResult) => error,
  );
}

/** Sessions running a concurrent build under the step's application name. */
async function onlineBuilds(pool: pg.Pool): Promise<number> {
  const { rows } = await pool.query<{ query: string }>(
    "select query from pg_stat_activity where application_name = $1 and datname = current_database()",
    [ONLINE_INDEX_APPLICATION_NAME],
  );
  return rows.filter((r) => /CREATE INDEX CONCURRENTLY/i.test(r.query)).length;
}

async function waitFor(check: () => Promise<boolean>, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

const INSERT_EVENT = `insert into domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
  values ('payment', '1', 'online.test', '{}'::jsonb, 'migration-test')`;

async function seed(pool: pg.Pool): Promise<void> {
  await pool.query(
    `insert into domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
     select 'payment', (g % 500)::text, 'type_' || (g % 20),
            jsonb_build_object('shopCheckoutSessionId', 'cs_' || g), 'migration-test'
       from generate_series(1, 5000) g`,
  );
}

/** name -> [oid, valid] for the 0399/0400 indexes that exist. */
async function indexes(pool: pg.Pool): Promise<Record<string, [number, boolean]>> {
  const { rows } = await pool.query<{ name: string; oid: number; valid: boolean }>(
    `select c.relname as name, c.oid::int as oid, i.indisvalid as valid
       from pg_index i join pg_class c on c.oid = i.indexrelid
      where c.relname = any($1) order by 1`,
    [INDEXES],
  );
  return Object.fromEntries(rows.map((r) => [r.name, [r.oid, r.valid]]));
}

async function ledger(pool: pg.Pool): Promise<number[]> {
  const { rows } = await pool.query<{ created_at: string }>(
    "select created_at from drizzle.__drizzle_migrations where created_at = any($1) order by 1",
    [[WHEN_0399, WHEN_0400]],
  );
  return rows.map((r) => Number(r.created_at));
}

async function withClient<T>(databaseUrl: string, run: (client: pg.Client) => Promise<T>) {
  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

describe.skipIf(!url)("online index step", { timeout: 180_000 }, () => {
  it("builds 0399/0400 concurrently without blocking writers, reruns as a no-op, and the runner adopts them", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0398);
      await seed(pool);

      // A writer with an open transaction. A concurrent build waits for it to finish, but must
      // not stop it, or any other writer, from inserting.
      const writer = await pool.connect();
      const logs: string[] = [];
      let step: Promise<void> | undefined;
      try {
        await writer.query("begin");
        await writer.query(INSERT_EVENT);

        step = withClient(databaseUrl, (client) =>
          runPendingOnlineIndexBuilds(client, null, { log: (line) => logs.push(line) }),
        );
        // Wait until the build is running and visible under its application name.
        const deadline = Date.now() + 10_000;
        let seen = false;
        while (!seen && Date.now() < deadline) {
          const { rows } = await pool.query<{ query: string }>(
            "select query from pg_stat_activity where application_name = $1 and datname = current_database()",
            [ONLINE_INDEX_APPLICATION_NAME],
          );
          seen = rows.some((r) => /CREATE INDEX CONCURRENTLY/i.test(r.query));
          if (!seen) await new Promise((r) => setTimeout(r, 50));
        }
        expect(seen).toBe(true);

        // Writes carry on while the build is in progress: no SHARE lock is held.
        const started = Date.now();
        await writer.query(INSERT_EVENT);
        await pool.query(INSERT_EVENT);
        expect(Date.now() - started).toBeLessThan(2_000);
        await writer.query("commit");
      } finally {
        await writer.query("rollback").catch(() => {});
        writer.release();
      }
      await step;

      const built = await indexes(pool);
      expect(Object.keys(built)).toEqual(INDEXES);
      expect(Object.values(built).every(([, valid]) => valid)).toBe(true);
      expect(await ledger(pool)).toEqual([]);
      expect(logs.filter((l) => l.includes(": built in"))).toHaveLength(3);

      // Re-run before the migrations are applied (a deploy killed after the step): no-op.
      const rerunLogs: string[] = [];
      await withClient(databaseUrl, (client) =>
        runPendingOnlineIndexBuilds(client, null, { log: (line) => rerunLogs.push(line) }),
      );
      expect(rerunLogs.filter((l) => l.endsWith("already built."))).toHaveLength(3);
      expect(await indexes(pool)).toEqual(built);

      // The runner records 0399/0400 without rebuilding (same index OIDs).
      await runMigrationsPerTransaction(pool);
      expect(await ledger(pool)).toEqual([WHEN_0399, WHEN_0400]);
      expect(await indexes(pool)).toEqual(built);

      // Once applied, nothing is pending.
      const afterLogs: string[] = [];
      await withClient(databaseUrl, (client) =>
        runPendingOnlineIndexBuilds(client, null, { log: (line) => afterLogs.push(line) }),
      );
      expect(afterLogs).toEqual(["Online index step: nothing to build."]);
    });
  });

  it("skips declarations above the ceiling", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0398);
      await withClient(databaseUrl, (client) =>
        runPendingOnlineIndexBuilds(client, THROUGH_0398, { log: () => {} }),
      );
      expect(await indexes(pool)).toEqual({});
      await withClient(databaseUrl, (client) =>
        runPendingOnlineIndexBuilds(client, WHEN_0399, { log: () => {} }),
      );
      expect(Object.keys(await indexes(pool))).toEqual([INDEXES[0]]);
    });
  });

  it("drops the INVALID index a failed build left and leaves a valid one alone", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0398);
      await seed(pool);
      await pool.query(
        `create index "domain_events_unapplied_money_session_idx" on domain_events (event_type)`,
      );
      const valid = await indexes(pool);

      // A unique build over duplicate values fails after creating the index entry.
      const failing = parseOnlineIndexDeclaration(
        "0399_domain_events_event_type_aggregate_idx",
        `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "domain_events_event_type_aggregate_id_idx"
           ON "domain_events" ("event_type")`,
      );
      const untouched = parseOnlineIndexDeclaration(
        "0400_unapplied_money_shop_payment_idx",
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "domain_events_unapplied_money_session_idx"
           ON "domain_events" (("payload"->>'shopCheckoutSessionId'))`,
      );
      const run = withClient(databaseUrl, (client) =>
        runOnlineIndexStep(client, [untouched, failing], { log: () => {} }),
      );
      await expect(run).rejects.toBeInstanceOf(OnlineIndexBuildError);
      await expect(run).rejects.toThrow(/dropped the INVALID index/);
      expect(await indexes(pool)).toEqual(valid);
    });
  });

  it("migrate-prod exits non-zero before any migration when an INVALID index is in the way", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0398);
      await seed(pool);
      // Someone else's failed (or still running) build: never dropped by the step.
      await expect(
        pool.query(
          `create unique index concurrently "domain_events_event_type_aggregate_id_idx"
             on domain_events (event_type)`,
        ),
      ).rejects.toThrow();
      const before = await indexes(pool);
      expect(Object.values(before)).toEqual([[expect.any(Number), false]]);

      const result = await runScript(MIGRATE_PROD_JS, {
        DATABASE_URL_OWNER: databaseUrl,
        PRODUCTION_MIGRATION_THROUGH: "head",
      });
      expect(result.code).not.toBe(0);
      // The step's own error, not the 0399 migration guard (which also says "exists but is
      // INVALID"): only the step raises OnlineIndexBuildError and labels the index with its tag.
      expect(result.stderr).toMatch(
        /OnlineIndexBuildError: Online index 0399_domain_events_event_type_aggregate_idx: domain_events_event_type_aggregate_id_idx: public\.domain_events_event_type_aggregate_id_idx exists but is INVALID/,
      );
      expect(result.stdout).not.toMatch(/Online index .*: building concurrently/);
      expect(await indexes(pool)).toEqual(before);
      expect(await ledger(pool)).toEqual([]);
    });
  });

  it.each([
    [
      "migrate-prod.js",
      MIGRATE_PROD_JS,
      "DATABASE_URL_OWNER",
      { PRODUCTION_MIGRATION_THROUGH: "head" },
    ],
    ["migrate.js with ONLINE_INDEX_STEP=1", MIGRATE_JS, "DATABASE_URL", { ONLINE_INDEX_STEP: "1" }],
  ] as const)(
    "%s builds the indexes concurrently before the runner, with a writer transaction open",
    async (_name, script, urlEnv, extraEnv) => {
      await withTemporaryDatabase(async (pool, databaseUrl) => {
        await runMigrationsPerTransactionThrough(pool, THROUGH_0398);
        await seed(pool);
        const writer = await pool.connect();
        let child: Promise<ScriptResult> | undefined;
        try {
          await writer.query("begin");
          await writer.query(INSERT_EVENT);
          child = runScript(script, { [urlEnv]: databaseUrl, ...extraEnv });

          // The build waits for the open writer; while it does, no migration has run yet.
          expect(await waitFor(async () => (await onlineBuilds(pool)) > 0, 30_000)).toBe(true);
          expect(await ledger(pool)).toEqual([]);
          const started = Date.now();
          await writer.query(INSERT_EVENT);
          await pool.query(INSERT_EVENT);
          expect(Date.now() - started).toBeLessThan(2_000);
          await writer.query("commit");
        } finally {
          await writer.query("rollback").catch(() => {});
          writer.release();
        }
        const result = await child;
        expect(result?.stderr).toBe("");
        expect(result?.code).toBe(0);
        const out = result?.stdout ?? "";
        const built = [...out.matchAll(/Online index (\S+): \S+: built in/g)].map((m) => m[1]);
        expect(built).toEqual([
          "0399_domain_events_event_type_aggregate_idx",
          "0400_unapplied_money_shop_payment_idx",
          "0400_unapplied_money_shop_payment_idx",
        ]);
        const lastBuilt = out.lastIndexOf(": built in");
        const finished = Math.max(
          out.indexOf("Migrations applied."),
          out.indexOf("Production migrations and role grants applied."),
        );
        expect(lastBuilt).toBeGreaterThan(-1);
        expect(finished).toBeGreaterThan(lastBuilt);
        expect(await ledger(pool)).toEqual([WHEN_0399, WHEN_0400]);
        expect(Object.values(await indexes(pool)).every(([, valid]) => valid)).toBe(true);
      });
    },
  );

  it("migrate.js without ONLINE_INDEX_STEP does not run the step (local and CI)", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0398);
      await seed(pool);
      const result = await runScript(MIGRATE_JS, { DATABASE_URL: databaseUrl });
      expect(result.code).toBe(0);
      expect(result.stdout).not.toMatch(/Online index/);
      expect(result.stdout).toMatch(/Migrations applied\./);
      // The migrations built the indexes themselves, in their own transactions.
      expect(Object.keys(await indexes(pool))).toEqual(INDEXES);
      expect(await ledger(pool)).toEqual([WHEN_0399, WHEN_0400]);
    });
  });

  it("migrate.js rejects an ONLINE_INDEX_STEP value other than 1 before migrating", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0398);
      const result = await runScript(MIGRATE_JS, {
        DATABASE_URL: databaseUrl,
        ONLINE_INDEX_STEP: "true",
      });
      expect(result.code).not.toBe(0);
      expect(result.stderr).toMatch(/ONLINE_INDEX_STEP must be 1/);
      expect(await ledger(pool)).toEqual([]);
    });
  });

  it("does not drop an INVALID index another session created during this build", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0398);
      await seed(pool);
      const name = INDEXES[0];
      const declaration = parseOnlineIndexDeclaration(
        "0399_domain_events_event_type_aggregate_idx",
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}" ON "domain_events" ("event_type")`,
      );

      // An open writer keeps the other session's concurrent build waiting (and its index
      // INVALID) for as long as the test needs.
      const writer = await pool.connect();
      const other = new pg.Client(buildPgConnectionConfig(databaseUrl));
      await other.connect();
      let otherBuild: Promise<unknown> | undefined;
      try {
        await writer.query("begin");
        await writer.query(INSERT_EVENT);
        const run = withClient(databaseUrl, (client) => {
          // Between the step's "before" check and its CREATE, another session starts the same
          // build. The step then times out on the table lock that build holds.
          const racing: OnlineIndexClient = {
            async query(text, values) {
              if (text.startsWith("CREATE INDEX CONCURRENTLY") && !otherBuild) {
                otherBuild = other.query(
                  `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}" ON domain_events (event_type)`,
                );
                const appeared = await waitFor(
                  async () => (await indexes(pool))[name] !== undefined,
                  10_000,
                );
                if (!appeared) throw new Error("the other build never created its index");
              }
              return client.query(text, values) as never;
            },
          };
          return runOnlineIndexStep(racing, [declaration], { log: () => {} });
        });
        await expect(run).rejects.toBeInstanceOf(OnlineIndexBuildError);
        await expect(run).rejects.toThrow(
          /lock timeout; left the INVALID index "public"\."domain_events_event_type_aggregate_id_idx" in place: another session \(pid \d+\)/,
        );
        // The other session's build is untouched and still in progress.
        expect((await indexes(pool))[name]?.[1]).toBe(false);
        await writer.query("commit");
        await otherBuild;
        expect((await indexes(pool))[name]?.[1]).toBe(true);
      } finally {
        await writer.query("rollback").catch(() => {});
        writer.release();
        await other.end();
      }
    });
  });
});
