/**
 * Enforces DIP for admin HTTP routes: only `container.admin` (not `container.adminUserService`, etc.).
 * Existing violations are frozen in admin-dip-allowlist.json; new references fail the build.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const staticFiles = [
  "src/routes/admin.ts",
  "src/routes/admin-invitations.ts",
  "src/routes/admin-legal-entity-lifecycle.ts",
  "src/routes/xero-admin.ts",
];

const adminDir = join(root, "src/routes/admin");
const adminModuleFiles = readdirSync(adminDir)
  .filter((name) => name.endsWith(".routes.ts"))
  .map((name) => `src/routes/admin/${name}`);

const files = [...staticFiles, ...adminModuleFiles];

/** Skip import paths like `../container.js` (slash before `container`). */
const re = /(?<![\w./])container\.(\w+)\b/g;

const allowlistPath = join(__dirname, "admin-dip-allowlist.json");
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));

/** @type {Map<string, Set<string>>} */
const allowedByFile = new Map(
  Object.entries(allowlist).map(([file, refs]) => [file, new Set(refs)]),
);

/** @type {Map<string, Set<string>>} */
const foundByFile = new Map(files.map((file) => [file, new Set()]));

let failed = false;
for (const rel of files) {
  const path = join(root, rel);
  const text = readFileSync(path, "utf8");
  const allowed = allowedByFile.get(rel) ?? new Set();
  const found = foundByFile.get(rel);
  const warned = new Set();
  re.lastIndex = 0;

  for (;;) {
    const m = re.exec(text);
    if (m === null) break;
    const name = m[1];
    if (name === "admin") continue;

    const ref = `container.${name}`;
    found.add(ref);

    if (allowed.has(ref)) {
      if (!warned.has(ref)) {
        warned.add(ref);
        console.warn(`[check-admin-routes-dip] ${rel}: allowlisted debt "${ref}"`);
      }
      continue;
    }

    console.error(`[check-admin-routes-dip] ${rel}: forbidden reference "${ref}"`);
    failed = true;
  }
}

for (const [file, allowed] of allowedByFile) {
  const found = foundByFile.get(file) ?? new Set();
  for (const ref of allowed) {
    if (!found.has(ref)) {
      console.error(
        `[check-admin-routes-dip] ${file}: allowlist entry "${ref}" no longer present — remove it from admin-dip-allowlist.json`,
      );
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
