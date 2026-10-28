import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = (file: string) => readFileSync(join(__dirname, "../drizzle", file), "utf8");

type Assignment = {
  user_id: string;
  role: string;
  ends_at: Date | null;
  granted_by_user_id: string | null;
  reason: string | null;
};

describe.skipIf(!url)("migration 0242 staff role clean-up", () => {
  it("moves every staff member to the new roles and the rollback restores them", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const forward = sql("0242_staff_role_cleanup.sql");
    const rollback = sql("0242_rollback.sql");
    const run = randomUUID().slice(0, 8);
    const id = (name: string) => `m0242_${name}_${run}`;
    const people = {
      admin: id("admin"),
      ops: id("ops"),
      service: id("service"),
      viewer: id("viewer"),
      finance: id("finance"),
    };
    const ids = Object.values(people);
    const assignments = async () =>
      (
        await client.query<Assignment>(
          `select user_id, role::text as role, ends_at, granted_by_user_id, reason
           from staff_role_assignment where user_id = any($1)
           order by user_id, role::text, ends_at nulls first`,
          [ids],
        )
      ).rows;
    const profiles = async () =>
      (
        await client.query<{ user_id: string; staff_role: string }>(
          `select user_id, staff_role::text as staff_role from bid_user_profile
           where user_id = any($1) order by user_id`,
          [ids],
        )
      ).rows;

    // The database starts at the newest migration; step back to the previous role names.
    await client.query(rollback);
    try {
      const primary: Record<string, string> = {
        [people.admin]: "super_admin",
        [people.ops]: "operations",
        [people.service]: "support_concierge",
        [people.viewer]: "staff_viewer",
        [people.finance]: "finance_ops",
      };
      for (const userId of ids) {
        await client.query(
          `insert into "user" (id, name, email, email_verified, created_at, updated_at)
           values ($1, $1, $1 || '@migration.test', true, now(), now())`,
          [userId],
        );
        await client.query(
          `insert into bid_user_profile (user_id, role, staff_role, created_at, updated_at)
           values ($1, 'staff', $2, now() - interval '10 days', now())`,
          [userId, primary[userId]],
        );
      }
      const assign = (userId: string, role: string, startsDaysAgo: number, endsDaysAgo?: number) =>
        client.query(
          `insert into staff_role_assignment (user_id, role, starts_at, ends_at, granted_by_user_id, reason)
           values ($1, $2, now() - make_interval(days => $3),
                   case when $4::int is null then null else now() - make_interval(days => $4::int) end,
                   $5, 'hired')`,
          [userId, role, startsDaysAgo, endsDaysAgo ?? null, people.admin],
        );
      await assign(people.admin, "super_admin", 9);
      await assign(people.ops, "operations", 9);
      await assign(people.service, "support_concierge", 9);
      await assign(people.service, "client_advisor", 5);
      await assign(people.viewer, "staff_viewer", 9);
      await assign(people.viewer, "content_marketing", 9, 1);
      await assign(people.finance, "finance_ops", 9);
      const before = await assignments();

      const invite = await client.query<{ id: string }>(
        `insert into user_invitation (email, target_role, target_staff_role, token_hash, expires_at, created_by_user_id)
         values ($1, 'staff', 'operations', $2, now() + interval '7 days', $3) returning id`,
        [`invitee_${run}@migration.test`, `token_${run}`, people.admin],
      );
      const inviteId = invite.rows[0]?.id;
      await client.query(
        `insert into user_invitation_product_grant (invitation_id, product, role) values ($1, 'bid', 'operations')`,
        [inviteId],
      );

      // A pending organisation invitation still using a removed role stops the migration.
      await client.query(
        `insert into user_invitation (email, target_role, token_hash, expires_at, created_by_user_id, target_legal_entity_member_role)
         values ($1, 'client', $2, now() + interval '7 days', $3, 'staff')`,
        [`org_${run}@migration.test`, `org_token_${run}`, people.admin],
      );
      await expect(client.query(forward)).rejects.toThrow(
        /organisation roles specialist and staff are still used/,
      );
      await client.query("delete from user_invitation where token_hash = $1", [`org_token_${run}`]);

      await client.query(forward);

      const moved = "role clean-up: replaces operations";
      expect(await assignments()).toEqual([
        {
          user_id: people.admin,
          role: "administrator",
          ends_at: null,
          granted_by_user_id: people.admin,
          reason: "hired",
        },
        {
          user_id: people.finance,
          role: "finance",
          ends_at: null,
          granted_by_user_id: people.admin,
          reason: "hired",
        },
        {
          user_id: people.ops,
          role: "cataloguer",
          ends_at: null,
          granted_by_user_id: null,
          reason: moved,
        },
        {
          user_id: people.ops,
          role: "client_services",
          ends_at: null,
          granted_by_user_id: null,
          reason: moved,
        },
        {
          user_id: people.ops,
          role: "fulfilment",
          ends_at: null,
          granted_by_user_id: null,
          reason: moved,
        },
        {
          user_id: people.ops,
          role: "sales_manager",
          ends_at: null,
          granted_by_user_id: null,
          reason: moved,
        },
        {
          user_id: people.service,
          role: "client_services",
          ends_at: null,
          granted_by_user_id: people.admin,
          reason: "hired",
        },
        {
          user_id: people.viewer,
          role: "read_only",
          ends_at: null,
          granted_by_user_id: people.admin,
          reason: "hired",
        },
        {
          user_id: people.viewer,
          role: "read_only",
          ends_at: expect.any(Date),
          granted_by_user_id: people.admin,
          reason: "hired",
        },
      ]);
      expect(await profiles()).toEqual(
        [
          { user_id: people.admin, staff_role: "administrator" },
          { user_id: people.finance, staff_role: "finance" },
          { user_id: people.ops, staff_role: "sales_manager" },
          { user_id: people.service, staff_role: "client_services" },
          { user_id: people.viewer, staff_role: "read_only" },
        ].sort((a, b) => a.user_id.localeCompare(b.user_id)),
      );
      const invitation = await client.query(
        `select i.target_staff_role::text as invited, g.role as granted
         from user_invitation i join user_invitation_product_grant g on g.invitation_id = i.id
         where i.id = $1 and g.product = 'bid'`,
        [inviteId],
      );
      expect(invitation.rows).toEqual([{ invited: "sales_manager", granted: "sales_manager" }]);
      const directory = await client.query(
        `select role from lax_staff_access_directory where product = 'bid' and subject_id = $1`,
        [people.ops],
      );
      expect(directory.rows).toEqual([{ role: "sales_manager" }]);
      const enumValues = await client.query<{ value: string }>(
        "select unnest(enum_range(null::user_staff_role))::text as value",
      );
      expect(enumValues.rows.map((r) => r.value)).toEqual([
        "administrator",
        "sales_manager",
        "saleroom_clerk",
        "cataloguer",
        "specialist",
        "client_services",
        "finance",
        "fulfilment",
        "compliance",
        "read_only",
      ]);
      const memberRoles = await client.query<{ value: string }>(
        "select unnest(enum_range(null::legal_entity_member_role))::text as value",
      );
      expect(memberRoles.rows.map((r) => r.value)).toEqual([
        "owner",
        "admin",
        "consignor",
        "finance",
        "buyer_agent",
        "viewer",
      ]);

      // The rollback puts back exactly what each person had.
      await client.query(rollback);
      expect(await assignments()).toEqual(before);
      expect(await profiles()).toEqual(
        ids
          .map((userId) => ({ user_id: userId, staff_role: primary[userId] }))
          .sort((a, b) => a.user_id.localeCompare(b.user_id)),
      );
      const restoredInvite = await client.query(
        "select target_staff_role::text as invited from user_invitation where id = $1",
        [inviteId],
      );
      // An invitation carries one role; the rollback gives back the nearest previous one.
      expect(restoredInvite.rows).toEqual([{ invited: "auction_manager" }]);
    } finally {
      await client.query("delete from user_invitation where created_by_user_id = any($1)", [ids]);
      await client.query("delete from bid_user_profile where user_id = any($1)", [ids]);
      await client.query(`delete from "user" where id = any($1)`, [ids]);
      const atHead = await client.query(
        "select to_regclass('public.staff_role_cleanup_snapshot') is not null as applied",
      );
      if (!atHead.rows[0]?.applied) await client.query(forward);
      await client.end();
    }
  });
});
