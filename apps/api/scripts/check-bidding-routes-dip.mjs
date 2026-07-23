/**
 * Enforces DIP for buyer participation HTTP routes: only `container.bidding` (+ middleware infra).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const files = [
  "src/routes/bids.ts",
  "src/routes/lots/bidding.routes.ts",
  "src/routes/sales/registration.routes.ts",
  "src/routes/telephone-bookings/buyer.routes.ts",
  "src/routes/saleroom-display.ts",
];

/** Allowed bare container keys in buyer participation route files. */
const ALLOWED_CONTAINER_KEYS = new Set([
  "bidding",
  "env",
  "redis",
  "kycService",
  "userSuspensionChecker",
  "requireSubmissionsLegalEntityContext",
]);

const re = /(?<![\w./])container\.(\w+)\b/g;

/** @type {Map<string, Set<string>>} */
const foundByFile = new Map(files.map((file) => [file, new Set()]));

let failed = false;
for (const rel of files) {
  const path = join(root, rel);
  const text = readFileSync(path, "utf8");
  const found = foundByFile.get(rel);
  re.lastIndex = 0;

  for (;;) {
    const m = re.exec(text);
    if (m === null) break;
    const name = m[1];
    if (ALLOWED_CONTAINER_KEYS.has(name)) continue;

    const ref = `container.${name}`;
    found.add(ref);
    console.error(`[check-bidding-routes-dip] ${rel}: forbidden reference "${ref}"`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
