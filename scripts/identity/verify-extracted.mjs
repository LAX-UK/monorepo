#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  IDENTITY_ALLOWED_TOP_LEVEL,
  IDENTITY_PACKAGE_PATHS,
  IDENTITY_SCRIPT_FILES,
} from "./closure.mjs";
import { verifyDockerClosure } from "./verify-docker-closure.mjs";

function run(command, args, cwd, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed${capture ? `:\n${result.stderr || result.stdout}` : ""}`,
    );
  }
  return result.stdout?.trim() ?? "";
}

function verifyTreeShape(root) {
  const allowed = new Set(IDENTITY_ALLOWED_TOP_LEVEL);
  const violations = readdirSync(root)
    .filter((entry) => !allowed.has(entry))
    .map((entry) => `unexpected top-level extraction path ${entry}`);

  for (const path of [...IDENTITY_PACKAGE_PATHS, ...IDENTITY_SCRIPT_FILES]) {
    if (!existsSync(join(root, path))) violations.push(`missing extracted path ${path}`);
  }

  const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  for (const path of IDENTITY_PACKAGE_PATHS) {
    if (!workspace.includes(`"${path}"`)) violations.push(`workspace omits ${path}`);
  }
  if (/["'](?:apps|packages)\/\*["']/.test(workspace)) {
    violations.push("workspace uses a broad package glob");
  }

  const npmrc = readFileSync(join(root, ".npmrc"), "utf8");
  if (!/^node-linker=isolated$/m.test(npmrc)) {
    violations.push(".npmrc does not require the isolated linker");
  }

  return violations;
}

function verifyRefs(root) {
  const branches = run("git", ["for-each-ref", "--format=%(refname)", "refs/heads"], root, {
    capture: true,
  })
    .split("\n")
    .filter(Boolean);
  const tags = run("git", ["tag", "--list"], root, { capture: true }).split("\n").filter(Boolean);
  const remotes = run("git", ["for-each-ref", "--format=%(refname)", "refs/remotes"], root, {
    capture: true,
  })
    .split("\n")
    .filter(Boolean);
  const violations = [];
  if (branches.length !== 1) violations.push(`expected one local branch, found ${branches.length}`);
  if (tags.length > 0) violations.push(`unexpected tags: ${tags.join(", ")}`);
  if (remotes.length > 0) violations.push(`unexpected remote refs: ${remotes.join(", ")}`);
  return violations;
}

export function verifyExtractedIdentity(root, { scanSecrets = true } = {}) {
  const violations = [...verifyTreeShape(root), ...verifyDockerClosure(root), ...verifyRefs(root)];
  if (violations.length > 0) {
    throw new Error(`Extracted Identity verification failed:\n${violations.join("\n")}`);
  }

  run("node", ["scripts/check-layers.mjs"], root);
  run("node", ["scripts/ci/verify-identity-extractability.mjs"], root);
  if (scanSecrets) {
    run("gitleaks", ["detect", "--source", ".", "--log-opts=--all", "--verbose", "--redact"], root);
  }
}

if (resolve(process.argv[1] ?? "") === resolve(new URL(import.meta.url).pathname)) {
  const root = resolve(process.argv[2] ?? ".");
  verifyExtractedIdentity(root, {
    scanSecrets: !process.argv.includes("--skip-secret-scan"),
  });
  console.log("verify-extracted-identity: ok");
}
