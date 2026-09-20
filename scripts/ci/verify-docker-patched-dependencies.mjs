#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function posix(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
}

export function dockerCopySources(dockerfile) {
  const logicalLines = dockerfile.replace(/\\\r?\n\s*/g, " ").split(/\r?\n/);
  const sources = new Set();

  for (const line of logicalLines) {
    const trimmed = line.trim();
    if (!/^COPY\s+/i.test(trimmed) || /^COPY\s+--from=/i.test(trimmed)) continue;
    const words = trimmed.split(/\s+/).slice(1);
    while (words[0]?.startsWith("--")) words.shift();
    for (const source of words.slice(0, -1)) sources.add(posix(source));
  }

  return sources;
}

export function patchedDependencyPathsFromManifest(manifest) {
  const patched = manifest?.pnpm?.patchedDependencies ?? {};
  return Object.values(patched)
    .map((value) => {
      if (typeof value === "string") return posix(value);
      if (value && typeof value === "object" && typeof value.path === "string") {
        return posix(value.path);
      }
      return null;
    })
    .filter((path) => typeof path === "string" && path.length > 0);
}

function sourceCovers(sources, requiredPath) {
  if (sources.has(".") || sources.has(requiredPath)) return true;
  const parts = requiredPath.split("/");
  for (let index = 1; index < parts.length; index += 1) {
    if (sources.has(parts.slice(0, index).join("/"))) return true;
  }
  return false;
}

export function verifyDockerfilePatchedDependencies(dockerfile, patchPaths) {
  if (patchPaths.length === 0) return [];
  if (!/\bpnpm(?:@[^\s]+)?(?:\s+\S+)*\s+install\b/.test(dockerfile)) return [];

  const sources = dockerCopySources(dockerfile);
  const copiesRootManifest = sources.has("package.json") || sources.has(".");
  if (!copiesRootManifest) return [];

  return patchPaths.flatMap((patchPath) =>
    sourceCovers(sources, patchPath) ? [] : [`missing COPY for patched dependency ${patchPath}`],
  );
}

export function listDockerfiles(root) {
  const found = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
      const fullPath = join(current, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (
        entry === "Dockerfile" ||
        entry.endsWith(".Dockerfile") ||
        entry.endsWith(".dockerfile")
      ) {
        found.push(fullPath);
      }
    }
  }
  return found.sort();
}

export function verifyRepositoryDockerPatchedDependencies(root) {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const patchPaths = patchedDependencyPathsFromManifest(manifest);
  const violations = [];
  for (const dockerfilePath of listDockerfiles(root)) {
    const dockerfile = readFileSync(dockerfilePath, "utf8");
    for (const violation of verifyDockerfilePatchedDependencies(dockerfile, patchPaths)) {
      violations.push(`${relative(root, dockerfilePath)}: ${violation}`);
    }
  }
  return violations;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "../.."));
  if (!existsSync(join(root, "package.json"))) {
    throw new Error(`package.json not found in ${root}`);
  }
  const violations = verifyRepositoryDockerPatchedDependencies(root);
  if (violations.length > 0) {
    console.error("Docker patchedDependencies drift detected:\n");
    for (const violation of violations) console.error(`  ${violation}`);
    process.exit(1);
  }
  console.log("verify-docker-patched-dependencies: ok");
}
