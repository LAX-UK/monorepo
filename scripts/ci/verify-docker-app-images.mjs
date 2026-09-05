#!/usr/bin/env node
/**
 * Builds auth and web Docker images locally (no push) to catch missing
 * Dockerfile context inputs before deploy workflows run.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "Docker image verification" });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const images = [
  {
    name: "auth",
    file: "apps/auth/Dockerfile",
    buildArgs: [],
  },
  {
    name: "web",
    file: "apps/web/Dockerfile",
    buildArgs: ["--build-arg", "TURBO_CONCURRENCY=1"],
  },
];

for (const image of images) {
  console.log(`building ${image.name} image (${image.file})`);
  run("docker", [
    "build",
    "-f",
    image.file,
    "-t",
    `lax-${image.name}:ci-verify`,
    ...image.buildArgs,
    ".",
  ]);
}

console.log("docker image verification passed for auth and web");
