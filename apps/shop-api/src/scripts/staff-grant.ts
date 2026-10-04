import { closeDb, createDb } from "@auction/db";
import type { ShopStaffRole } from "@auction/shop-domain";
import { loadShopApiEnv } from "../env.js";
import { grantShopStaffRole } from "../infrastructure/grant-staff-role.js";

const ROLES: readonly ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];

function usage(): never {
  console.error(
    `Usage: staff-grant --subject <identity-subject-id> --role <${ROLES.join("|")}> --operator <ops:email>`,
  );
  process.exit(1);
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const subject = readArg("--subject")?.trim();
const role = readArg("--role")?.trim() as ShopStaffRole | undefined;
const operator = readArg("--operator")?.trim();

if (!subject || !role || !operator) {
  usage();
}
if (!ROLES.includes(role)) {
  console.error(`Invalid role: ${role}`);
  usage();
}

const env = loadShopApiEnv();
const db = createDb(env.DATABASE_URL_SHOP);

try {
  await grantShopStaffRole(db, { subject, role, operatorSubjectId: operator });
  console.log(`Granted ${role} to ${subject}`);
} finally {
  await closeDb(db);
}
