#!/usr/bin/env node
/**
 * Read-only GitHub Actions statistics for pipeline tuning (Phase 0 baseline).
 * Usage: node scripts/ci/pipeline-stats.mjs [--workflows CI,"App deploy test"] [--limit 50]
 */
import { spawnSync } from "node:child_process";

const DEFAULT_WORKFLOWS = [
  "CI",
  "Web PR browser gates",
  "App deploy test",
  "Build images",
  "Terraform apply test",
  "Shop staging acceptance",
  "Shop staging acceptance (scheduled)",
  "Identity extraction rehearsal",
];

function parseArgs(argv) {
  const opts = {
    workflows: [...DEFAULT_WORKFLOWS],
    limit: 50,
    repo: process.env.GITHUB_REPOSITORY,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--workflows" && argv[i + 1]) {
      opts.workflows = argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      opts.limit = Number(argv[++i]);
    } else if (argv[i] === "--repo" && argv[i + 1]) {
      opts.repo = argv[++i];
    }
  }
  if (!opts.repo) {
    console.error("Set GITHUB_REPOSITORY or pass --repo owner/name");
    process.exit(1);
  }
  return opts;
}

function ghApi(path) {
  const result = spawnSync("gh", ["api", "-H", "Accept: application/vnd.github+json", path], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `gh api failed: ${path}`);
  }
  return JSON.parse(result.stdout);
}

export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function runDurationSeconds(run) {
  const start = Date.parse(run.run_started_at || run.created_at);
  const end = Date.parse(run.updated_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 1000);
}

export function summarizeRuns(runs) {
  const completed = runs.filter((r) => r.status === "completed");
  const durations = completed
    .map(runDurationSeconds)
    .filter((d) => d != null)
    .sort((a, b) => a - b);
  const failed = completed.filter((r) => r.conclusion === "failure").length;
  const cancelled = completed.filter((r) => r.conclusion === "cancelled").length;
  const success = completed.filter((r) => r.conclusion === "success").length;
  return {
    total: runs.length,
    completed: completed.length,
    success,
    failed,
    cancelled,
    failure_rate: completed.length ? failed / completed.length : null,
    p50_s: percentile(durations, 50),
    p90_s: percentile(durations, 90),
  };
}

function formatSeconds(s) {
  if (s == null) return "—";
  if (s < 120) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

function fetchWorkflowRuns(owner, name, workflowName, limit) {
  const runs = [];
  let page = 1;
  while (runs.length < limit) {
    const perPage = Math.min(100, limit - runs.length);
    const payload = ghApi(`/repos/${owner}/${name}/actions/workflows?per_page=100`);
    const wf = (payload.workflows ?? []).find((w) => w.name === workflowName);
    if (!wf) {
      return { runs: [], missing: true };
    }
    const pagePayload = ghApi(
      `/repos/${owner}/${name}/actions/workflows/${wf.id}/runs?per_page=${perPage}&page=${page}`,
    );
    const batch = pagePayload.workflow_runs ?? [];
    if (batch.length === 0) break;
    runs.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return { runs: runs.slice(0, limit), missing: false };
}

function fetchJobStats(owner, name, runId) {
  const payload = ghApi(`/repos/${owner}/${name}/actions/runs/${runId}/jobs?per_page=100`);
  const jobs = payload.jobs ?? [];
  const byName = new Map();
  for (const job of jobs) {
    if (job.status !== "completed") continue;
    const start = Date.parse(job.started_at);
    const end = Date.parse(job.completed_at);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const sec = Math.round((end - start) / 1000);
    const list = byName.get(job.name) ?? [];
    list.push(sec);
    byName.set(job.name, list);
  }
  return byName;
}

function runCli() {
  const opts = parseArgs(process.argv);
  const [owner, repoName] = opts.repo.split("/");

  console.log(`Pipeline stats for ${opts.repo} (last ${opts.limit} runs per workflow)\n`);

  const jobAggregate = new Map();

  for (const workflowName of opts.workflows) {
    const { runs, missing } = fetchWorkflowRuns(owner, repoName, workflowName, opts.limit);
    if (missing) {
      console.log(`## ${workflowName}\n  (workflow not found)\n`);
      continue;
    }
    const summary = summarizeRuns(runs);
    const rate = summary.failure_rate != null ? `${(summary.failure_rate * 100).toFixed(1)}%` : "—";
    console.log(`## ${workflowName}`);
    console.log(
      `  runs=${summary.total} success=${summary.success} failed=${summary.failed} cancelled=${summary.cancelled} failure_rate=${rate}`,
    );
    console.log(
      `  duration p50=${formatSeconds(summary.p50_s)} p90=${formatSeconds(summary.p90_s)}`,
    );

    const sampleRun = runs.find((r) => r.conclusion === "success" && r.status === "completed");
    if (sampleRun && workflowName === "CI") {
      const jobs = fetchJobStats(owner, repoName, sampleRun.id);
      for (const [jobName, durations] of jobs) {
        const sorted = [...durations].sort((a, b) => a - b);
        const agg = jobAggregate.get(jobName) ?? { p50: [], p90: [] };
        agg.p50.push(percentile(sorted, 50));
        agg.p90.push(percentile(sorted, 90));
        jobAggregate.set(jobName, agg);
      }
    }
    console.log("");
  }

  if (jobAggregate.size > 0) {
    console.log("## CI job sample (from one latest successful CI run)");
    for (const [jobName, agg] of [...jobAggregate.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const p50 = agg.p50[0];
      const p90 = agg.p90[0];
      console.log(`  ${jobName}: p50=${formatSeconds(p50)} p90=${formatSeconds(p90)}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
