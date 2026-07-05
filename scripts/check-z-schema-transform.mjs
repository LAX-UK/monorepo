/**
 * Guardrail: z.custom() only validates — its callback return value is discarded.
 * HTTP row schemas must use zTransformParse / .transform() with explicit parsers.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const httpDir = join(root, "apps/web/src/lib/data/http");

const SKIP = new Set(["node_modules", "dist", ".turbo"]);
const ALLOW_Z_CUSTOM = new Set(["apps/web/src/lib/data/http/schema-coerce.ts"]);

/** @param {string} dir @returns {string[]} */
function listTsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listTsFiles(full));
    else if (entry.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/** @param {string} text */
function findZCustomUsages(text) {
  /** @type {number[]} */
  const lineNumbers = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const code = lines[i].replace(/\/\/.*$/, "");
    if (code.includes("z.custom")) lineNumbers.push(i + 1);
  }
  return lineNumbers;
}

/** @type {string[]} */
const violations = [];

for (const file of listTsFiles(httpDir)) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (ALLOW_Z_CUSTOM.has(rel)) continue;
  const text = readFileSync(file, "utf8");
  const lines = findZCustomUsages(text);
  for (const line of lines) {
    violations.push(`${rel}:${line} — use zTransformParse(parseFn) instead of z.custom`);
  }
}

if (violations.length > 0) {
  console.error(
    "z.custom is forbidden in HTTP schemas (use zTransformParse from schema-coerce.ts):\n",
  );
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("check-z-schema-transform: OK");
