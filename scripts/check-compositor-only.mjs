#!/usr/bin/env node
/**
 * Compositor-only motion check. Fails on `transition: all` and on transitions or keyframes of
 * layout and paint properties (see scripts/compositor-rule.mjs), except the offenders listed in
 * scripts/compositor-allowlist.json. The allowlist only shrinks: fix an offender, then lower or
 * remove its entry.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareWithAllowlist, findCompositorViolations } from "./compositor-rule.mjs";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Folders whose files can hold motion, relative to the repository root. */
export const COMPOSITOR_ROOTS = ["apps", "packages"];

const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", "coverage", "e2e"]);
const SOURCE_FILE = /\.(?:css|[cm]?[jt]sx?)$/;
const TEST_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/;

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) listFiles(full, out);
    else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) out.push(full);
  }
  return out;
}

export function scan(root = repoRoot) {
  const byFile = new Map();
  for (const top of COMPOSITOR_ROOTS) {
    for (const file of listFiles(join(root, top))) {
      const findings = findCompositorViolations(readFileSync(file, "utf8"));
      if (findings.length > 0) byFile.set(relative(root, file).split(sep).join("/"), findings);
    }
  }
  return byFile;
}

function main() {
  const allowlist = JSON.parse(
    readFileSync(join(repoRoot, "scripts/compositor-allowlist.json"), "utf8"),
  ).entries;
  const problems = compareWithAllowlist(scan(), allowlist);
  if (problems.length > 0) {
    console.error(
      `Motion must stay on the compositor (docs/design/motion.md):\n  ${problems.join("\n  ")}`,
    );
    process.exit(1);
  }
  console.log("compositor-only motion: ok");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
