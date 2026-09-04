/**
 * Enforces DIP for buyer user HTTP routes: only `container.userRoutes` (+ middleware infra).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const files = [
  "src/routes/users.ts",
  "src/routes/users/public.routes.ts",
  "src/routes/users/category-interests.routes.ts",
  "src/routes/users/dashboard.routes.ts",
  "src/routes/users/watchlist.routes.ts",
  "src/routes/users/notifications.routes.ts",
  "src/routes/users/preferences.routes.ts",
  "src/routes/users/profile.routes.ts",
  "src/routes/users/security.routes.ts",
  "src/routes/ssf-events.ts",
];

const ALLOWED_CONTAINER_KEYS = new Set(["userRoutes", "userSuspensionChecker", "env", "authDb"]);

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
      console.error(`[check-user-routes-dip] ${rel}: forbidden reference "${ref}"`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
