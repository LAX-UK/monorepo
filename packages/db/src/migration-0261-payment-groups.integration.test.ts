import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8").replaceAll("--> statement-breakpoint", "");

/** Runs in one transaction that is always rolled back; each probe sits in a savepoint. */
describe.skipIf(!migrationUrl)("migration 0261 payment groups", { timeout: 30_000 }, () => {
  let client: pg.Client;
  let entityId: string;

  async function succeeds(sql: string, params: unknown[]): Promise<boolean> {
    await client.query("savepoint probe");
    try {
      await client.query(sql, params);
      return true;
    } catch {
      return false;
    } finally {
      await client.query("rollback to savepoint probe");
    }
  }

  const chargeIndexDefinition = async () => {
    const res = await client.query(
      `select indexdef from pg_indexes where indexname = 'payment_stripe_charge_id_uidx'`,
    );
    return String(res.rows[0]?.indexdef ?? "");
  };

  beforeAll(async () => {
    client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
    await client.connect();
  });

  afterAll(async () => {
    await client.query("rollback");
    await client.end();
  });

  beforeEach(async () => {
    await client.query("rollback");
    await client.query("begin");
    const user = await client.query(
      `insert into "user" (id, email, name, created_at, updated_at) values (gen_random_uuid()::text, $1, 'Probe', now(), now()) returning id`,
      [`probe-${Date.now()}@example.com`],
    );
    const entity = await client.query(
      `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
       values ('organisation', 'gallery', 'Probe', $1) returning id`,
      [user.rows[0].id],
    );
    entityId = entity.rows[0].id as string;
  });

  it("keeps a group's status, rail and total to known values", async () => {
    await client.query(read("0261_payment_groups.sql"));
    const insert = `insert into payment_group (buyer_legal_entity_id, status, checkout_rail, total_amount)
                    values ($1, $2, $3, $4)`;
    expect(await succeeds(insert, [entityId, "open", "card", "10.00"])).toBe(true);
    expect(await succeeds(insert, [entityId, "settling", "card", "10.00"])).toBe(false);
    expect(await succeeds(insert, [entityId, "open", "cheque", "10.00"])).toBe(false);
    expect(await succeeds(insert, [entityId, "open", "card", "0"])).toBe(false);
  });

  it("holds one charge per payment only outside a group", async () => {
    await client.query(read("0261_payment_groups.sql"));
    expect(await chargeIndexDefinition()).toContain("payment_group_id IS NULL");
  });

  it("rolls back to one charge per payment and drops the groups", async () => {
    await client.query(read("0261_payment_groups.sql"));
    await client.query(read("0261_rollback.sql"));
    expect(await chargeIndexDefinition()).not.toContain("payment_group_id");
    const table = await client.query("select to_regclass('payment_group') as t");
    expect(table.rows[0].t).toBeNull();
    const column = await client.query(
      `select 1 from information_schema.columns where table_name = 'payment' and column_name = 'payment_group_id'`,
    );
    expect(column.rowCount).toBe(0);
  });
});
