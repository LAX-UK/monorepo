#!/usr/bin/env node
/**
 * Exits 1 if the CI workflow did not succeed for the current commit SHA.
 * Used by deploy workflows (requires GH_TOKEN / github.token).
 */
import { spawnSync } from "node:child_process";

const sha = process.env.GITHUB_SHA;
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!sha || !repo || !token) {
  console.error("Requires GITHUB_SHA, GITHUB_REPOSITORY, and GITHUB_TOKEN");
  process.exit(1);
}

const [owner, name] = repo.split("/");
const query = spawnSync(
  "gh",
  [
    "api",
    "-H",
    "Accept: application/vnd.github+json",
    `/repos/${owner}/${name}/actions/runs?head_sha=${sha}&per_page=20`,
  ],
  { encoding: "utf8", env: { ...process.env, GH_TOKEN: token } },
);

if (query.status !== 0) {
  console.error(query.stderr || query.stdout);
  process.exit(query.status ?? 1);
}

const payload = JSON.parse(query.stdout);
const ciRun = (payload.workflow_runs ?? []).find((r) => r.name === "CI");
if (!ciRun) {
  console.error(`No CI workflow run found for commit ${sha}`);
  process.exit(1);
}
if (ciRun.conclusion !== "success") {
  console.error(`CI conclusion for ${sha}: ${ciRun.conclusion ?? ciRun.status}`);
  process.exit(1);
}

console.log(`CI passed for ${sha} (run ${ciRun.id})`);
