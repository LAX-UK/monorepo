#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY_DOCKER, IDENTITY_PACKAGES, IDENTITY_PACKAGE_NAMES } from "./closure.mjs";

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

export function verifyDockerClosureText(dockerfile) {
  const sources = dockerCopySources(dockerfile);
  const violations = [];

  for (const manifestPath of IDENTITY_DOCKER.manifestCopyPaths) {
    if (!sources.has(manifestPath)) violations.push(`missing manifest COPY ${manifestPath}`);
  }
  for (const sourcePath of IDENTITY_DOCKER.sourceCopyPaths) {
    if (!sources.has(sourcePath)) violations.push(`missing source COPY ${sourcePath}`);
  }
  if (!sources.has(IDENTITY_DOCKER.prepareScript)) {
    violations.push(`missing tool COPY ${IDENTITY_DOCKER.prepareScript}`);
  }
  if (!dockerfile.includes(`--filter ${IDENTITY_DOCKER.workspaceFilter}`)) {
    violations.push(`missing workspace filter ${IDENTITY_DOCKER.workspaceFilter}`);
  }

  const copiedPackageManifests = [...sources].filter((source) =>
    /^(?:apps|packages)\/[^/]+\/package\.json$/.test(source),
  );
  for (const copiedPath of copiedPackageManifests) {
    if (!IDENTITY_DOCKER.manifestCopyPaths.includes(copiedPath)) {
      violations.push(`unexpected package manifest COPY ${copiedPath}`);
    }
  }

  return violations;
}

export function verifyPackageClosure(root) {
  const violations = [];
  const allowedNames = new Set(IDENTITY_PACKAGE_NAMES);

  for (const expected of IDENTITY_PACKAGES) {
    const manifestPath = join(root, expected.path, "package.json");
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (error) {
      violations.push(`${expected.path}: unreadable package.json (${error.message})`);
      continue;
    }
    if (manifest.name !== expected.name) {
      violations.push(
        `${expected.path}: expected package name ${expected.name}, got ${manifest.name}`,
      );
    }

    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const name of Object.keys(manifest[field] ?? {})) {
        if (name.startsWith("@auction/") && !allowedNames.has(name)) {
          violations.push(`${expected.name} ${field} contains out-of-closure package ${name}`);
        }
      }
    }
  }

  return violations;
}

export function verifyDockerClosure(root) {
  const dockerfilePath = join(root, IDENTITY_DOCKER.dockerfile);
  const dockerViolations = verifyDockerClosureText(readFileSync(dockerfilePath, "utf8"));
  const packageViolations = verifyPackageClosure(root);
  return [...dockerViolations, ...packageViolations];
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "../.."));
  const violations = verifyDockerClosure(root);
  if (violations.length > 0) {
    console.error("Identity Docker/package closure drift detected:\n");
    for (const violation of violations) console.error(`  ${violation}`);
    process.exit(1);
  }
  console.log(
    `verify-docker-closure: ok (${IDENTITY_PACKAGES.length} packages; ${relative(root, join(root, IDENTITY_DOCKER.dockerfile))})`,
  );
}
