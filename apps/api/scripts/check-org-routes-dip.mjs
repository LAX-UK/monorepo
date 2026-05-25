/**
 * Enforces DIP for org/legal-entity HTTP routes: only allowlisted `container.*` accessors.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const files = [
  "src/routes/legal-entities.ts",
  "src/routes/legal-entity-members.ts",
  "src/routes/stripe-connect.ts",
  "src/routes/organizations.ts",
];

const allowed = new Set([
  "userSuspensionChecker",
  "legalEntityRepository",
  "personalLegalEntityResolver",
  "legalEntityAccessService",
  "pendingInvitationsReader",
  "invitationLifecycleService",
  "userService",
  "memberManagementService",
  "requireLegalEntityContext",
  "db",
  "organizationOnboardingService",
  "orgModuleGate",
  "stripeConnectService",
]);

const re = /(?<![\w./])container\.(\w+)\b/g;

let failed = false;
for (const rel of files) {
  const path = join(root, rel);
  const text = readFileSync(path, "utf8");
  const seen = new Set();
  for (;;) {
    const m = re.exec(text);
    if (m === null) break;
    const name = m[1];
    if (!allowed.has(name)) {
      const key = `${rel}:${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.error(
          `[check-org-routes-dip] ${rel}: forbidden or unknown reference "container.${name}"`,
        );
        failed = true;
      }
    }
  }
}

if (failed) {
  process.exit(1);
}
