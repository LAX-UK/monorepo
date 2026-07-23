/**
 * Enforces DIP for submission HTTP routes: only `container.submissionRoutes` (+ middleware infra).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const files = [
  "src/routes/submissions.ts",
  "src/routes/submissions/seller.routes.ts",
  "src/routes/submissions/admin.routes.ts",
  "src/routes/submission-documents.ts",
];

const ALLOWED_CONTAINER_KEYS = new Set([
  "submissionRoutes",
  "userSuspensionChecker",
  "requireSubmissionsLegalEntityContext",
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
      console.error(`[check-submissions-routes-dip] ${rel}: forbidden reference "${ref}"`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
