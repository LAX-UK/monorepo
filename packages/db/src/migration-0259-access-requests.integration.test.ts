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

const NEW_TYPES = ["access_requested", "access_request_decided"];
const KEPT_TYPES = [
  "outbid",
  "delivery_quote_ready",
  "organisation_member_left",
  "payout_bank_changed",
];

/** Runs in one transaction that is always rolled back; each probe sits in a savepoint. */
describe.skipIf(!migrationUrl)("migration 0259 access requests", { timeout: 30_000 }, () => {
  let client: pg.Client;
  let userId: string;
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

  const acceptsType = (type: string) =>
    succeeds(`insert into notification (user_id, type, title, message) values ($1, $2, 't', 'm')`, [
      userId,
      type,
    ]);

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
    await client.query(read("0259_rollback.sql"));
    const user = await client.query(
      `insert into "user" (id, email, name, created_at, updated_at)
       values (gen_random_uuid()::text, $1, 'Probe', now(), now()) returning id`,
      [`probe-${Date.now()}@example.com`],
    );
    userId = user.rows[0].id as string;
    const entity = await client.query(
      `insert into legal_entity (display_name, kind, subkind, created_by_user_id, status)
       values ('Probe', 'organisation', 'gallery', $1, 'approved') returning id`,
      [userId],
    );
    entityId = entity.rows[0].id as string;
  });

  const insertAsk = (role: string | null, capability: string | null) =>
    succeeds(
      `insert into access_request (legal_entity_id, requester_user_id, requested_role,
         requested_capability, reason) values ($1, $2, $3, $4, 'why')`,
      [entityId, userId, role, capability],
    );

  it("allows the access notices and keeps every earlier type", async () => {
    await client.query(read("0259_workspace_access_requests.sql"));
    for (const type of [...NEW_TYPES, ...KEPT_TYPES]) expect(await acceptsType(type)).toBe(true);
  });

  it("asks for exactly one of a role or a capability, once while pending", async () => {
    await client.query(read("0259_workspace_access_requests.sql"));
    expect(await insertAsk(null, null)).toBe(false);
    expect(await insertAsk("admin", "entity.bid.place")).toBe(false);
    await client.query(
      `insert into access_request (legal_entity_id, requester_user_id, requested_role, reason)
       values ($1, $2, 'admin', 'why')`,
      [entityId, userId],
    );
    expect(await insertAsk("admin", null)).toBe(false);
    expect(await insertAsk(null, "entity.bid.place")).toBe(true);
  });

  it("rolls back to the previous list", async () => {
    await client.query(read("0259_workspace_access_requests.sql"));
    await client.query(read("0259_rollback.sql"));
    for (const type of NEW_TYPES) expect(await acceptsType(type)).toBe(false);
    for (const type of KEPT_TYPES) expect(await acceptsType(type)).toBe(true);
    const table = await client.query("select to_regclass('access_request') as t");
    expect(table.rows[0].t).toBeNull();
  });
});
