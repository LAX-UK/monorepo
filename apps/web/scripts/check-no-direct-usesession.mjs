/**
 * Fails when `authClient.useSession()` is called outside the single owner module.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, "..", "src");
const ownerRelative = "lib/auth/auth-session-provider.tsx";
const pattern = /authClient\.useSession\s*\(\s*\)/;

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

/** @type {Array<{ file: string; line: number }>} */
const violations = [];

for (const file of walk(srcRoot)) {
  const rel = relative(srcRoot, file).replace(/\\/g, "/");
  if (rel === ownerRelative) continue;
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      violations.push({ file: rel, line: i + 1 });
    }
  }
}

if (violations.length > 0) {
  console.error("authClient.useSession() must only be called from auth-session-provider.tsx:\n");
  for (const v of violations) {
    console.error(`  src/${v.file}:${v.line}`);
  }
  process.exit(1);
}

console.log("check-no-direct-usesession: ok");
