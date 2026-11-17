/**
 * Grants one LAX Admin staff role to each existing dev-seed account (packages/db
 * src/seed/dev/legacy-demo-seed.ts), so every role can be signed in locally without inventing
 * identities. Re-running converges on the same roles. Run through `seed:local-admin-staff`.
 */
import {
  type Database,
  type SeedTargetEnv,
  assertSeedEnvironment,
  assertSeedTarget,
  isLocalSeedAddress,
} from "@auction/db";
import type { ShopStaffRole } from "@auction/shop-domain";
import { grantShopStaffRole } from "../grant-staff-role.js";

/**
 * broker has no dedicated dev account; gallery-admin is the closest fit because brokers act for
 * gallery-side clients.
 */
export const LOCAL_ADMIN_STAFF: ReadonlyArray<{ role: ShopStaffRole; email: string }> = [
  { role: "shop_admin", email: "admin@lax.bid" },
  { role: "catalogue_editor", email: "staff-catalogue@lax.bid" },
  // Editorial work moved to its own role; the catalogue account keeps it.
  { role: "editor", email: "staff-catalogue@lax.bid" },
  { role: "operations", email: "staff-operations@lax.bid" },
  { role: "finance", email: "accountant@lax.bid" },
  { role: "account_manager", email: "staff-advisor@lax.bid" },
  { role: "broker", email: "gallery-admin@lax.bid" },
];

export const LOCAL_ADMIN_STAFF_OPERATOR = "seed:local-admin-staff";

/** Both databases must be at a local address; the Shop one must also be hermetic (see below). */
export function assertLocalAddresses(
  urls: readonly string[],
  env: Omit<SeedTargetEnv, "databaseUrl">,
): void {
  for (const url of urls) {
    assertSeedEnvironment(LOCAL_ADMIN_STAFF_OPERATOR, { ...env, databaseUrl: url });
    if (!isLocalSeedAddress({ databaseUrl: url, appEnv: env.appEnv })) {
      throw new Error(
        `[${LOCAL_ADMIN_STAFF_OPERATOR}] refusing to seed: "${new URL(url).hostname}" is not local`,
      );
    }
  }
}

/**
 * Grants the roles, only on a hermetic Shop database: marked "local" (the demo seed mark) and at a
 * local address. An address alone is not enough, since a loopback address can be a tunnel.
 */
export async function grantLocalAdminStaff(
  db: Database,
  env: SeedTargetEnv,
  subjects: ReadonlyMap<string, string>,
  grant: typeof grantShopStaffRole = grantShopStaffRole,
): Promise<void> {
  const target = await assertSeedTarget(db, LOCAL_ADMIN_STAFF_OPERATOR, env);
  if (!target.hermetic) {
    throw new Error(
      `[${LOCAL_ADMIN_STAFF_OPERATOR}] refusing to seed: the database is marked "${target.environment}", not a hermetic local one`,
    );
  }
  for (const { role, email } of LOCAL_ADMIN_STAFF) {
    const subject = subjects.get(email);
    if (!subject) throw new Error(`Dev account not found: ${email}. Run the dev seed first.`);
    await grant(db, { subject, role, operatorSubjectId: LOCAL_ADMIN_STAFF_OPERATOR });
    console.log(`${role.padEnd(17)} ${email}`);
  }
}
