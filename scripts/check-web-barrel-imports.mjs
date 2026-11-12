#!/usr/bin/env node
/**
 * Bid web guard: `apps/web` imports the shared kits through their own subpaths, never through the
 * package barrels (`@auction/ui`, `@auction/ui/lax`, `@auction/marketing-ui`). The rule lives in
 * web-barrel-imports-rule.mjs.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { barrelImports } from "./web-barrel-imports-rule.mjs";

const WEB_SRC = path.resolve(import.meta.dirname, "../apps/web/src");

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (/\.tsx?$/.test(ent.name)) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of await walk(WEB_SRC)) {
  const rel = path.relative(WEB_SRC, file).split(path.sep).join("/");
  for (const specifier of new Set(barrelImports(await readFile(file, "utf8")))) {
    violations.push(`${rel}: imports the ${specifier} barrel — import the component's own subpath`);
  }
}

if (violations.length > 0) {
  console.error("error: barrel imports in apps/web:\n");
  for (const v of violations.sort()) console.error(`  ${v}`);
  process.exit(1);
}
console.log("web barrel imports: ok");
