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
const UP = "0248_lax_admin_staff_roles.sql";
const DOWN = "0248_rollback.sql";

/** Runs inside one transaction that is always rolled back. */
describe.skipIf(!migrationUrl)("migration 0248 LAX Admin staff roles", () => {
  let client: pg.Client;
  const marker = `m0248-${Date.now()}`;
  const subject = (name: string) => `${marker}-${name}`;

  async function assignments(name: string): Promise<string[]> {
    const { rows } = await client.query(
      `select role::text as role from shop_staff_role_assignment
       where identity_subject_id = $1 and ends_at is null order by role`,
      [subject(name)],
    );
    return rows.map((r) => r.role as string);
  }

  async function directory(name: string): Promise<string[]> {
    const { rows } = await client.query(
      "select role from lax_staff_role_directory where subject_id = $1 order by role",
      [subject(name)],
    );
    return rows.map((r) => r.role as string);
  }

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
    // Back to the single-role model, with one member per role and one whose access was removed.
    await client.query(read(DOWN));
    for (const role of [
      "shop_admin",
      "account_manager",
      "broker",
      "operations",
      "finance",
      "catalogue_editor",
    ]) {
      await client.query(
        "insert into shop_staff_member (identity_subject_id, role) values ($1, $2)",
        [subject(role), role],
      );
    }
    await client.query(
      "insert into shop_staff_member (identity_subject_id, role, disabled_at) values ($1, 'finance', now())",
      [subject("disabled")],
    );
    await client.query(read(UP));
  });

  it("keeps every active member's role and gives catalogue editors Editor too", async () => {
    for (const role of ["shop_admin", "account_manager", "broker", "operations", "finance"]) {
      expect(await assignments(role)).toEqual([role]);
    }
    expect(await assignments("catalogue_editor")).toEqual(["catalogue_editor", "editor"]);
  });

  it("gives a member whose access was removed no roles", async () => {
    expect(await assignments("disabled")).toEqual([]);
  });

  it("mirrors every assignment into the directory Bid reads", async () => {
    expect(await directory("catalogue_editor")).toEqual(["catalogue_editor", "editor"]);
    await client.query(
      "update shop_staff_role_assignment set ends_at = now(), end_recorded_at = now() where identity_subject_id = $1 and role = 'editor'",
      [subject("catalogue_editor")],
    );
    const { rows } = await client.query(
      "select end_recorded_at is not null as ended from lax_staff_role_directory where subject_id = $1 and role = 'editor'",
      [subject("catalogue_editor")],
    );
    expect(rows[0]?.ended).toBe(true);
  });

  it("refuses a second open assignment of the same role", async () => {
    await client.query("savepoint dup");
    await expect(
      client.query(
        "insert into shop_staff_role_assignment (identity_subject_id, role) values ($1, 'broker')",
        [subject("broker")],
      ),
    ).rejects.toThrow();
    await client.query("rollback to savepoint dup");
  });

  it("allows the new role-change notifications", async () => {
    const { rows } = await client.query(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'notification_type_check'",
    );
    expect(rows[0]?.def).toContain("staff_role_changed_admin");
  });

  it("rolls back to one role per person: Editor returns to Catalogue editor, Read-only loses access", async () => {
    await client.query("delete from shop_staff_role_assignment where identity_subject_id = $1", [
      subject("operations"),
    ]);
    await client.query(
      "update shop_staff_member set role = 'editor' where identity_subject_id = $1",
      [subject("operations")],
    );
    await client.query(
      "update shop_staff_member set role = 'read_only' where identity_subject_id = $1",
      [subject("broker")],
    );
    await client.query(read(DOWN));
    const { rows } = await client.query(
      `select identity_subject_id as id, role::text as role, disabled_at is not null as disabled
       from shop_staff_member where identity_subject_id = any($1) order by identity_subject_id`,
      [[subject("operations"), subject("broker")]],
    );
    expect(rows).toEqual([
      { id: subject("broker"), role: "catalogue_editor", disabled: true },
      { id: subject("operations"), role: "catalogue_editor", disabled: false },
    ]);
    const table = await client.query(
      "select to_regclass('public.shop_staff_role_assignment') as t",
    );
    expect(table.rows[0]?.t).toBeNull();
    await client.query(read(UP));
  });
});
