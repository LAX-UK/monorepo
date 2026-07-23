/**
 * Enforces DIP for catalogue lifecycle HTTP routes: only `container.catalogRoutes` (+ allowed infra).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const files = [
  "src/routes/sales/lifecycle.routes.ts",
  "src/routes/sales/lots.routes.ts",
  "src/routes/sales/follow.routes.ts",
  "src/routes/lots/lifecycle.routes.ts",
];

const ALLOWED_CONTAINER_KEYS = new Set(["catalogRoutes"]);

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
      console.error(`[check-catalog-lifecycle-routes-dip] ${rel}: forbidden reference "${ref}"`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
