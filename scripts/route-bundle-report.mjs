#!/usr/bin/env node
/**
 * Where a route's start-up JavaScript comes from. Reads the bundle analyser's JSON (build with
 * `ANALYZE=true ANALYZE_MODE=json`) and one route's start-up files, then prints the top owners,
 * the shared-kit files shipped and the Node polyfill modules.
 *
 * Usage: node scripts/route-bundle-report.mjs --app apps/web --route "/(marketing)/sales/[slug]/[id]/page" [--top 15]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { kitFiles, leafModules, moduleOwner, ownerTotals } from "./route-bundle-report-rule.mjs";
import { startupSet } from "./route-js-startup-set.mjs";

const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const app = arg("--app", "apps/web");
const route = arg("--route");
const top = Number(arg("--top", "15"));
if (!route) {
  console.error(
    'usage: route-bundle-report.mjs --app apps/web --route "/(marketing)/lot/[slug]/[id]/page"',
  );
  process.exit(2);
}

const nextDir = path.join(import.meta.dirname, "..", app, ".next");
const analyzePath = path.join(nextDir, "analyze", "client.json");
if (!existsSync(analyzePath)) {
  console.error(`no ${analyzePath}; build with ANALYZE=true ANALYZE_MODE=json first`);
  process.exit(2);
}
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const set = startupSet(
  readJson(path.join(nextDir, "app-build-manifest.json")),
  readJson(path.join(nextDir, "build-manifest.json")),
  route,
);
if (!set) {
  console.error(`${route} is not in ${app}'s build`);
  process.exit(2);
}
const wanted = new Set([...set.frame, ...set.page]);
const chunks = readJson(analyzePath).filter((chunk) => wanted.has(chunk.label));
const kb = (value) => `${value.toFixed(1)} KB`;

console.log(
  `${app} ${route}: ${chunks.length} of ${wanted.size} start-up files are in the analyser output`,
);
console.log("\nTop owners (gzip estimate)");
for (const row of ownerTotals(chunks).slice(0, top)) {
  console.log(`  ${kb(row.gzipKb).padStart(9)}  ${row.owner} (${row.modules} modules)`);
}
for (const kit of ["ui", "marketing-ui"]) {
  const files = kitFiles(chunks, kit);
  const total = files.reduce((sum, file) => sum + file.gzipKb, 0);
  console.log(`\n@auction/${kit}: ${files.length} files shipped, ${kb(total)}`);
  for (const file of files.slice(0, top))
    console.log(`  ${kb(file.gzipKb).padStart(9)}  ${file.file}`);
}
const polyfills = chunks
  .flatMap((chunk) => leafModules(chunk).map((leaf) => ({ chunk: chunk.label, ...leaf })))
  .filter((leaf) =>
    /node_modules\/(buffer|ieee754|base64-js|process|stream-browserify)\//.test(leaf.path),
  );
console.log(`\nNode polyfill modules: ${polyfills.length}`);
for (const leaf of polyfills)
  console.log(`  ${leaf.chunk}  ${moduleOwner(leaf.path)}  ${leaf.path}`);
