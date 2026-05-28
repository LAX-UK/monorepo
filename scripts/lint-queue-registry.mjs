#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const registryPath = join(root, "packages/queues/src/registry.ts");
const registrySource = readFileSync(registryPath, "utf8");
const registryNames = new Set(
  [...registrySource.matchAll(/export const [A-Z_]+ = "([^"]+)"/g)].map((m) => m[1]),
);

const appsDir = join(root, "apps");
const pattern = /new\s+(?:Queue|Worker)\s*(?:<[^>]*>)?\s*\(\s*["'`]([^"'`]+)["'`]/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];
for (const app of readdirSync(appsDir)) {
  const appPath = join(appsDir, app, "src");
  try {
    statSync(appPath);
  } catch {
    continue;
  }
  for (const file of walk(appPath)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) {
      const name = match[1];
      if (!registryNames.has(name)) {
        offenders.push({ file: relative(root, file), name });
      }
    }
  }
}

if (offenders.length > 0) {
  console.error("Queue/Worker names missing from QUEUE_REGISTRY:");
  for (const o of offenders) {
    console.error(`  ${o.name} in ${o.file}`);
  }
  process.exit(1);
}

console.log(`queue registry lint ok (${registryNames.size} queues)`);
