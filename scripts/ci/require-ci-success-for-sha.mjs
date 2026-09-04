#!/usr/bin/env node
/**
 * Waits until required workflow runs for GITHUB_SHA complete, then exits 0 only on success.
 * Deploy workflows start in parallel with CI; this job polls instead of failing on "pending".
 */
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const sha = process.env.GITHUB_SHA;
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const maxWaitMs = Number(process.env.CI_GATE_MAX_WAIT_MS ?? 90 * 60 * 1000);
const pollMs = Number(process.env.CI_GATE_POLL_MS ?? 30_000);
const requiredWorkflows = ["CI", ...(process.env.CI_GATE_REQUIRE_BROWSER === "1" ? ["Web PR browser gates"] : [])];

if (!sha || !repo || !token) {
  console.error("Requires GITHUB_SHA, GITHUB_REPOSITORY, and GITHUB_TOKEN");
  process.exit(1);
}

const [owner, name] = repo.split("/");

function fetchLatestRun(workflowName) {
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
  const runs = (payload.workflow_runs ?? []).filter((r) => r.name === workflowName);
  if (runs.length === 0) return null;
  runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return runs[0];
}

function workflowState(workflowName) {
  const run = fetchLatestRun(workflowName);
  if (!run) return { status: "missing" };
  if (run.status !== "completed") return { status: "pending", run };
  if (run.conclusion !== "success") return { status: "failed", run };
  return { status: "success", run };
}

const deadline = Date.now() + maxWaitMs;

while (Date.now() < deadline) {
  let allSuccess = true;
  for (const workflowName of requiredWorkflows) {
    const state = workflowState(workflowName);
    if (state.status === "missing") {
      console.log(`No ${workflowName} run yet for ${sha}; retrying in ${pollMs / 1000}s…`);
      allSuccess = false;
      break;
    }
    if (state.status === "pending") {
      console.log(
        `${workflowName} run ${state.run.id} status=${state.run.status}; waiting ${pollMs / 1000}s…`,
      );
      allSuccess = false;
      break;
    }
    if (state.status === "failed") {
      console.error(`${workflowName} conclusion for ${sha}: ${state.run.conclusion}`);
      process.exit(1);
    }
  }

  if (allSuccess) {
    for (const workflowName of requiredWorkflows) {
      const run = fetchLatestRun(workflowName);
      console.log(`${workflowName} passed for ${sha} (run ${run?.id})`);
    }
    process.exit(0);
  }

  await setTimeout(pollMs);
}

console.error(`Timed out after ${maxWaitMs / 1000}s waiting for required workflows on ${sha}`);
process.exit(1);
