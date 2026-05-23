/**
 * Fails when dashboard routes expose raw HTTP error strings to users.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = join(__dirname, "..", "src", "app", "dashboard");

const legacyFailedToLoadRe = /Failed to load [^:]+:\s*\d{3}/;
const allowlist = new Set(["error.tsx"]);

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

/** @type {Array<{ file: string; line: number; match: string }>} */
const violations = [];

for (const file of walk(dashboardRoot)) {
  const base = file.split("/").pop() ?? "";
  if (allowlist.has(base)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(legacyFailedToLoadRe);
    if (match) {
      violations.push({ file, line: i + 1, match: match[0] });
    }
  }
}

if (violations.length > 0) {
  console.error("Dashboard routes must not expose raw HTTP fetch messages:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.match}`);
  }
  process.exit(1);
}

console.log("check-dashboard-error-copy: ok");
