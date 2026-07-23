#!/usr/bin/env node
/**
 * Waits until the CI workflow for GITHUB_SHA completes, then exits 0 only on success.
 * Deploy workflows start in parallel with CI; this job polls instead of failing on "pending".
 */
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const sha = process.env.GITHUB_SHA;
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const maxWaitMs = Number(process.env.CI_GATE_MAX_WAIT_MS ?? 90 * 60 * 1000);
const pollMs = Number(process.env.CI_GATE_POLL_MS ?? 30_000);

if (!sha || !repo || !token) {
  console.error("Requires GITHUB_SHA, GITHUB_REPOSITORY, and GITHUB_TOKEN");
  process.exit(1);
}

const [owner, name] = repo.split("/");

function fetchLatestCiRun() {
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
  const ciRuns = (payload.workflow_runs ?? []).filter((r) => r.name === "CI");
  if (ciRuns.length === 0) return null;
  ciRuns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return ciRuns[0];
}

const deadline = Date.now() + maxWaitMs;

while (Date.now() < deadline) {
  const ciRun = fetchLatestCiRun();
  if (!ciRun) {
    console.log(`No CI run yet for ${sha}; retrying in ${pollMs / 1000}s…`);
  } else if (ciRun.status === "completed") {
    if (ciRun.conclusion === "success") {
      console.log(`CI passed for ${sha} (run ${ciRun.id})`);
      process.exit(0);
    }
    console.error(`CI conclusion for ${sha}: ${ciRun.conclusion}`);
    process.exit(1);
  } else {
    console.log(`CI run ${ciRun.id} status=${ciRun.status}; waiting ${pollMs / 1000}s…`);
  }

  await setTimeout(pollMs);
}

console.error(`Timed out after ${maxWaitMs / 1000}s waiting for CI on ${sha}`);
process.exit(1);
