/**
 * Fails when new circular dependency chains appear outside circular-deps-allowlist.json.
 * Uses madge (works on all supported Node versions in CI and local dev).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import madge from "madge";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const allowlistPath = join(__dirname, "circular-deps-allowlist.json");
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));

/** @param {string[]} cycle */
function normalizeCycle(cycle) {
  return cycle
    .map((p) => p.replace(/\\/g, "/"))
    .sort()
    .join("||");
}

/** @type {Set<string>} */
const allowed = new Set(
  allowlist.allowedCycles.map((/** @type {string[]} */ cycle) => normalizeCycle(cycle)),
);

const result = await madge(["apps", "packages"], {
  baseDir: root,
  fileExtensions: ["ts", "tsx"],
  excludeRegExp: [
    /\.test\.(ts|tsx)$/,
    /\.spec\.(ts|tsx)$/,
    /\.integration\.test\.(ts|tsx)$/,
    /node_modules/,
    /\/dist\//,
  ],
});

const circular = result.circular();
/** @type {string[]} */
const unexpected = [];

for (const cycle of circular) {
  const key = normalizeCycle(cycle);
  if (!allowed.has(key)) {
    unexpected.push(cycle.join(" -> "));
  }
}

if (unexpected.length > 0) {
  console.error("New circular dependencies detected (not in circular-deps-allowlist.json):\n");
  for (const chain of unexpected) {
    console.error(`  ${chain}`);
  }
  console.error(
    "\nFix the cycle or add a documented exception to scripts/circular-deps-allowlist.json",
  );
  process.exit(1);
}

console.log(
  `check-circular-deps: ok (${circular.length} allowlisted cycle${circular.length === 1 ? "" : "s"})`,
);
