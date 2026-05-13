/**
 * Enforces DIP for admin HTTP routes: only `container.admin` (not `container.adminUserService`, etc.).
 * Exit 1 if any `container.<name>` appears where <name> !== "admin".
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const files = [
  "src/routes/admin.ts",
  "src/routes/admin-invitations.ts",
  "src/routes/admin-legal-entity-lifecycle.ts",
  "src/routes/xero-admin.ts",
];

/** Skip import paths like `../container.js` (slash before `container`). */
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
    if (name !== "admin") {
      const key = `${rel}:${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.error(`[check-admin-routes-dip] ${rel}: forbidden reference "container.${name}"`);
        failed = true;
      }
    }
  }
}

if (failed) {
  process.exit(1);
}
