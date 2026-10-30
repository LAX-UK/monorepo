/**
 * Enforces DIP for platform identity and organisation HTTP routes: only application services on the
 * container (`identityRoutes`, `buyerAgents`, `organisationMembership`, `organisationHome`,
 * `organisationBuying`, `organisationWorkspace`, `organisationTeam`) plus middleware infra.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const files = [
  "src/routes/auth.ts",
  "src/routes/legal-entities.ts",
  "src/routes/legal-entity-members.ts",
  "src/routes/legal-entity-buyer-agents.ts",
  "src/routes/legal-entity-bidding-limits.ts",
  "src/routes/organisation-membership.ts",
  "src/routes/organisation-home.ts",
  "src/routes/organisation-buying.ts",
  "src/routes/organisation-workspace.ts",
  "src/routes/organisation-team.ts",
  "src/routes/organizations.ts",
  "src/routes/organization-onboarding.ts",
];

const ALLOWED_CONTAINER_KEYS = new Set([
  "identityRoutes",
  "userSuspensionChecker",
  "authenticator",
  "env",
  "redis",
  "authDb",
  "requireLegalEntityContext",
  "orgModuleGate",
  "userService",
  "buyerAgents",
  // Welcome card and stopped member bids: application services behind ports.
  "organisationMembership",
  // Home's business figures: an application service over read-model ports.
  "organisationHome",
  // Registrations, purchases, courier quotes and collection: application services over ports.
  "organisationBuying",
  // Record search and Needs you across modules: application services over read-model ports.
  "organisationWorkspace",
  // Invoice details and Activity: application services over persistence ports.
  "organisationTeam",
]);

const re = /(?<![\w./])container\.(\w+)\b/g;

let failed = false;
for (const rel of files) {
  const path = join(root, rel);
  const text = readFileSync(path, "utf8");
  re.lastIndex = 0;
  const seen = new Set();
  for (;;) {
    const m = re.exec(text);
    if (m === null) break;
    const name = m[1];
    if (ALLOWED_CONTAINER_KEYS.has(name)) continue;
    const ref = `container.${name}`;
    if (!seen.has(ref)) {
      seen.add(ref);
      console.error(`[check-org-routes-dip] ${rel}: forbidden reference "${ref}"`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
