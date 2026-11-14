import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0384_unapplied_money_dedupe_key_uid.sql");
/** The rollback's statements without its own BEGIN/COMMIT, so the test's transaction holds them. */
const rollbackBody = read("0384_rollback.sql").replace(/^BEGIN;$|^COMMIT;$/gm, "");
/** The pre-check from the migration header, as an operator would run it. */
const preCheck = (() => {
  const lines = migration.split("\n");
  const start = lines.findIndex((l) => l.startsWith("-- Pre-check"));
  const query: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("--   ")) break;
    query.push(line.slice("--   ".length));
  }
  return query.join("\n");
})();
const EVENT = "payment.unapplied_money_received";

/** Everything runs inside one transaction that is rolled back at the end. */
describe.skipIf(!url)(
  "migration 0384 unapplied money dedupe key (database)",
  { timeout: 60_000 },
  () => {
    let client: pg.Client;
    const run = `m0384-${Date.now()}`;

    const insert = (eventType: string, dedupeKey: string | null) =>
      client.query(
        `insert into domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
         values ('payment', $1, $2, $3::jsonb, 'migration-test')`,
        [run, eventType, JSON.stringify(dedupeKey === null ? {} : { dedupeKey })],
      );
    /** Runs a statement under a savepoint; resolves to the error code it raised, or null. */
    const attempt = async (fn: () => Promise<unknown>): Promise<string | null> => {
      await client.query("savepoint s");
      try {
        await fn();
        await client.query("release savepoint s");
        return null;
      } catch (err) {
        await client.query("rollback to savepoint s");
        return (err as { code?: string }).code ?? "unknown";
      }
    };

    beforeAll(async () => {
      client = new Client(buildPgConnectionConfig(url as string));
      await client.connect();
      await client.query("begin");
      // Start from before 0384, as an older database would be.
      await client.query(rollbackBody);
    });

    afterAll(async () => {
      await client.query("rollback");
      await client.end();
    });

    it("the pre-check finds existing duplicates, and the migration then refuses with a clear message", async () => {
      await insert(EVENT, `${run}:dup`);
      await insert(EVENT, `${run}:dup`);
      const { rows } = await client.query<{ dedupe_key: string }>(preCheck);
      expect(rows.map((r) => r.dedupe_key)).toContain(`${run}:dup`);

      await client.query("savepoint s");
      await expect(client.query(migration)).rejects.toThrow(
        /duplicate payment\.unapplied_money_received/,
      );
      await client.query("rollback to savepoint s");
    });

    it("once the duplicates are gone, the migration applies and the database refuses a second event", async () => {
      await client.query(
        `delete from domain_events where aggregate_id = $1 and payload->>'dedupeKey' = $2
           and id <> (select min(id) from domain_events where aggregate_id = $1 and payload->>'dedupeKey' = $2)`,
        [run, `${run}:dup`],
      );
      expect((await client.query(preCheck)).rows).toEqual([]);
      await client.query(migration);
      // Applying it twice changes nothing.
      await client.query(migration);

      expect(await attempt(() => insert(EVENT, `${run}:dup`))).toBe("23505");
      expect(await attempt(() => insert(EVENT, `${run}:other`))).toBeNull();
      // Other event types may carry the same key (the "resolved" event does).
      expect(
        await attempt(() => insert("payment.unapplied_money_resolved", `${run}:dup`)),
      ).toBeNull();
      // Rows without a key never clash.
      expect(await attempt(() => insert(EVENT, null))).toBeNull();
      expect(await attempt(() => insert(EVENT, null))).toBeNull();
    });

    it("rolls back by dropping the index", async () => {
      await client.query(rollbackBody);
      expect(await attempt(() => insert(EVENT, `${run}:dup`))).toBeNull();
      const { rows } = await client.query(
        `select 1 from pg_indexes where indexname = 'domain_events_unapplied_money_dedupe_key_uid'`,
      );
      expect(rows).toEqual([]);
    });
  },
);
