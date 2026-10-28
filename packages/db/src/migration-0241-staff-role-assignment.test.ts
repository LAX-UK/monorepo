import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = (file: string) => readFileSync(join(__dirname, "../drizzle", file), "utf8");

describe.skipIf(!url)("migration 0241 staff role assignments", () => {
  it("gives each staff member their current role once, and rolls back cleanly", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const run = randomUUID().slice(0, 8);
    const people = [
      { id: `m0241_admin_${run}`, role: "staff", staffRole: "super_admin" },
      { id: `m0241_finance_${run}`, role: "staff", staffRole: "finance_ops" },
      { id: `m0241_legacy_${run}`, role: "staff", staffRole: null },
      { id: `m0241_client_${run}`, role: "client", staffRole: null },
    ];
    const ids = people.map((p) => p.id);
    try {
      const forward = sql("0241_staff_role_assignment.sql");
      const rollback = sql("0241_rollback.sql");
      await client.query(forward);

      for (const p of people) {
        await client.query(
          `insert into "user" (id, name, email, email_verified, created_at, updated_at)
           values ($1, $1, $1 || '@migration.test', true, now(), now())`,
          [p.id],
        );
        await client.query(
          `insert into bid_user_profile (user_id, role, staff_role, created_at, updated_at)
           values ($1, $2, $3, now() - interval '1 day', now())`,
          [p.id, p.role, p.staffRole],
        );
      }

      // Backfill runs again on a re-apply and never duplicates.
      await client.query(forward);
      await client.query(forward);

      const rows = await client.query<{
        user_id: string;
        role: string;
        ends_at: Date | null;
        granted_by_user_id: string | null;
        reason: string | null;
        in_force: boolean;
      }>(
        `select user_id, role, ends_at, granted_by_user_id, reason, starts_at <= now() as in_force
         from staff_role_assignment where user_id = any($1) order by user_id`,
        [ids],
      );
      expect(rows.rows).toEqual([
        {
          user_id: `m0241_admin_${run}`,
          role: "super_admin",
          ends_at: null,
          granted_by_user_id: null,
          reason: "migrated from single role",
          in_force: true,
        },
        {
          user_id: `m0241_finance_${run}`,
          role: "finance_ops",
          ends_at: null,
          granted_by_user_id: null,
          reason: "migrated from single role",
          in_force: true,
        },
      ]);

      await expect(
        client.query(
          `insert into staff_role_assignment (user_id, role) values ($1, 'super_admin')`,
          [`m0241_admin_${run}`],
        ),
      ).rejects.toThrow(/staff_role_assignment_open_uidx/);

      await client.query(rollback);
      const gone = await client.query(`select to_regclass('public.staff_role_assignment') as t`);
      expect(gone.rows[0]?.t).toBeNull();
      await client.query(forward);
      const again = await client.query(
        "select count(*)::int as n from staff_role_assignment where user_id = any($1)",
        [ids],
      );
      expect(again.rows[0]?.n).toBe(2);
    } finally {
      await client.query("delete from bid_user_profile where user_id = any($1)", [ids]);
      await client.query(`delete from "user" where id = any($1)`, [ids]);
      await client.end();
    }
  });
});
