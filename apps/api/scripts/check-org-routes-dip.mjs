/**
 * Enforces DIP for platform identity HTTP routes: only `container.identityRoutes` (+ middleware infra).
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
