/**
 * Enforces the frozen TanStack Query policy: `useQuery` and `HydrationBoundary`
 * may only appear in allowlisted feature areas (saleroom, lot-bid, invitations, disputes).
 * Infrastructure under lib/query/ is always allowed.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, "..", "src");
const allowlistPath = join(__dirname, "query-usage-allowlist.json");
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));

const patterns = [
  { name: "useQuery", re: /\buseQuery\s*\(/ },
  { name: "HydrationBoundary", re: /\bHydrationBoundary\b/ },
];

/** @param {string} rel */
function isAllowlisted(rel) {
  for (const entry of allowlist.prefixes) {
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      if (rel === entry) return true;
    } else if (rel.startsWith(entry)) {
      return true;
    }
  }
  return false;
}

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/** @type {Array<{ file: string; line: number; symbol: string }>} */
const violations = [];

for (const file of walk(srcRoot)) {
  const rel = relative(srcRoot, file).replace(/\\/g, "/");
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
  if (isAllowlisted(rel)) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const { name, re } of patterns) {
      if (re.test(lines[i])) {
        violations.push({ file: rel, line: i + 1, symbol: name });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    "TanStack Query usage outside allowlisted areas (see scripts/query-usage-allowlist.json):\n",
  );
  for (const v of violations) {
    console.error(`  src/${v.file}:${v.line}  (${v.symbol})`);
  }
  console.error(
    "\nDefault is RSC + *.server.ts. Add Query only for realtime, optimistic updates, or existing invitations/disputes pattern.",
  );
  process.exit(1);
}

console.log("check-query-usage: ok");
