import { closeDb, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import {
  formatLaxAdminRoleMigrationReport,
  planLaxAdminRoleMigrationReport,
} from "../application/admin/lax-admin-role-migration-report.js";

/**
 * Dry run of LAX Admin's move to several roles per person: every staff member's role now, their
 * roles after migration 0248, and the capabilities they gain or lose. Read-only: everything runs
 * in a read-only transaction that is rolled back. Exits 2 when anyone would lose access.
 */
const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_OWNER required");

const db = createDb(url);
try {
  const report = await db.transaction(async (tx) => {
    await tx.execute(sql`set transaction read only`);
    const members = await tx.execute<{
      subject: string;
      role: string;
      disabled: boolean;
      name: string | null;
      email: string | null;
    }>(sql`
      select m.identity_subject_id as subject,
             m.role::text as role,
             m.disabled_at is not null as disabled,
             coalesce(nullif(trim(p.name), ''), d.name) as name,
             coalesce(p.email, d.email) as email
      from shop_staff_member m
      left join shop_user_profile p on p.identity_subject_id = m.identity_subject_id
      left join bid_identity_directory d on d.subject_id = m.identity_subject_id
      order by lower(coalesce(nullif(trim(p.name), ''), d.name, p.email, d.email, m.identity_subject_id))
    `);
    const invitations = await tx.execute<{ email: string; roles: string[] }>(sql`
      select i.email, array_agg(g.role order by g.role) as roles
      from user_invitation i
      join user_invitation_product_grant g on g.invitation_id = i.id and g.product = 'shop'
      where i.status = 'pending'
      group by i.id, i.email
      order by i.email
    `);
    const rows = members.rows;
    return {
      environment: process.env.LAX_ADMIN_ROLES_ENVIRONMENT ?? "local",
      generatedAt: new Date(),
      active: rows
        .filter((row) => !row.disabled)
        .map((row) => ({
          subjectId: row.subject,
          name: row.name,
          email: row.email,
          role: row.role,
        })),
      disabled: rows.filter((row) => row.disabled).length,
      invitations: invitations.rows.map((row) => ({
        email: row.email,
        // Catalogue editors are invited to Editor as well, as the migration does.
        roles: row.roles.includes("catalogue_editor") ? [...row.roles, "editor"] : row.roles,
      })),
    };
  });
  console.log(formatLaxAdminRoleMigrationReport(report));
  if (planLaxAdminRoleMigrationReport(report).peopleWithLosses > 0) process.exitCode = 2;
} finally {
  await closeDb(db);
}
