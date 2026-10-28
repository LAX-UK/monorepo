import { pathToFileURL } from "node:url";
import pg from "pg";
import { buildPgConnectionConfig } from "../ssl.js";
import { planStaffRoleCleanup } from "../staff-role-cleanup/staff-role-cleanup-plan.js";
import { formatStaffRoleCleanupReport } from "../staff-role-cleanup/staff-role-cleanup-report.js";
import { createPgStaffRoleCleanupSource } from "../staff-role-cleanup/staff-role-cleanup-source.js";

/**
 * Dry run of the staff roles clean-up: every staff member's roles now and after, and the
 * permissions they gain or lose. Read-only: the session refuses writes, and the work runs in a
 * read-only transaction that is rolled back.
 */
export async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_OWNER required");
  const client = new pg.Client({
    ...buildPgConnectionConfig(url),
    options: "-c default_transaction_read_only=on",
  });
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const source = createPgStaffRoleCleanupSource(client);
    // One connection answers one query at a time.
    const members = await source.listStaffMembers();
    const invitations = await source.listPendingStaffInvitations();
    const organisationRoles = await source.listRetiredOrganisationRoleUse();
    const plan = planStaffRoleCleanup(members);
    console.log(
      formatStaffRoleCleanupReport({
        environment: process.env.STAFF_ROLE_CLEANUP_ENVIRONMENT ?? "local",
        generatedAt: new Date(),
        plan,
        invitations,
        organisationRoles,
      }),
    );
    if (plan.peopleWithLosses > 0 || organisationRoles.length > 0) process.exitCode = 2;
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "staff role clean-up report failed");
    process.exit(1);
  });
}
