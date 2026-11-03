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

/** Runs in one transaction that is always rolled back. */
describe.skipIf(!migrationUrl)("migration 0277 enquiry workflow", { timeout: 30_000 }, () => {
  let client: pg.Client;

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
    // Start from the 0274 shape so the backfill runs over rows that existed before.
    await client.query(read("0277_rollback.sql"));
  });

  async function seedOld() {
    const rows: [string, string, string, string, string][] = [
      ["selling", "Private sale enquiry\n\nA drawing", "new", "2026-01-01", "a@example.com"],
      ["buying", "Private sale enquiry\n\nA print", "new", "2026-01-02", "b@example.com"],
      ["other", "Just a question here", "new", "2026-01-03", "c@example.com"],
      ["press", "Press question here", "handled", "2026-01-04", "d@example.com"],
    ];
    for (const [topic, message, status, created, email] of rows) {
      await client.query(
        `insert into marketing_enquiry (topic, name, email, message, status, handled_at, created_at)
         values ($1, 'Probe', $5, $2, $3, case when $3 = 'handled' then now() end, $4)`,
        [topic, message, status, created, email],
      );
    }
  }

  it("numbers existing enquiries in arrival order, reads intent from the tag and closes handled ones", async () => {
    await seedOld();
    await client.query(read("0277_enquiry_workflow.sql"));
    const result = await client.query(
      "select reference, intent, status, version from marketing_enquiry order by created_at",
    );
    expect(result.rows).toEqual([
      { reference: "E-1001", intent: "private_sale_sell", status: "new", version: 1 },
      { reference: "E-1002", intent: "private_sale_buy", status: "new", version: 1 },
      { reference: "E-1003", intent: "general", status: "new", version: 1 },
      { reference: "E-1004", intent: "press", status: "closed", version: 1 },
    ]);
  });

  it("keeps numbering after the backfill, and a new enquiry starts new", async () => {
    await seedOld();
    await client.query(read("0277_enquiry_workflow.sql"));
    const created = await client.query(
      `insert into marketing_enquiry (topic, name, email, message)
       values ('buying', 'Probe', 'e@example.com', 'How do I bid?') returning reference, status, intent`,
    );
    expect(created.rows[0]).toEqual({ reference: "E-1005", status: "new", intent: "general" });
  });

  it("refuses a close reason on an open enquiry, a duplicate department rule and a second fallback", async () => {
    await client.query(read("0277_enquiry_workflow.sql"));
    await client.query("savepoint s1");
    await expect(
      client.query(
        `insert into marketing_enquiry (topic, name, email, message, close_reason)
         values ('buying', 'Probe', 'f@example.com', 'How do I bid?', 'spam')`,
      ),
    ).rejects.toThrow(/marketing_enquiry_close_reason_check/);
    await client.query("rollback to savepoint s1");

    const user = await client.query(
      `insert into "user" (id, email, name, created_at, updated_at)
       values (gen_random_uuid()::text, 'staff-probe@example.com', 'Staff', now(), now()) returning id`,
    );
    const userId = user.rows[0].id as string;
    const insertRule = (slug: string | null) =>
      client.query(
        "insert into enquiry_routing_rule (department_slug, assigned_to_user_id) values ($1, $2)",
        [slug, userId],
      );
    await insertRule("paintings");
    await insertRule(null);
    await client.query("savepoint s2");
    await expect(insertRule("paintings")).rejects.toThrow(/enquiry_routing_rule_department_uidx/);
    await client.query("rollback to savepoint s2");
    await expect(insertRule(null)).rejects.toThrow(/enquiry_routing_rule_fallback_uidx/);
  });

  it("clears the owner and the account link when the user is deleted", async () => {
    await client.query(read("0277_enquiry_workflow.sql"));
    const user = await client.query(
      `insert into "user" (id, email, name, created_at, updated_at)
       values (gen_random_uuid()::text, 'owner-probe@example.com', 'Owner', now(), now()) returning id`,
    );
    const userId = user.rows[0].id as string;
    const enquiry = await client.query(
      `insert into marketing_enquiry (topic, name, email, message, assigned_to_user_id, user_id)
       values ('buying', 'Probe', 'g@example.com', 'How do I bid?', $1, $1) returning id`,
      [userId],
    );
    await client.query(`delete from "user" where id = $1`, [userId]);
    const after = await client.query(
      "select assigned_to_user_id, user_id from marketing_enquiry where id = $1",
      [enquiry.rows[0].id],
    );
    expect(after.rows[0]).toEqual({ assigned_to_user_id: null, user_id: null });
  });
});
