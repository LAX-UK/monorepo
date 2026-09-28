#!/usr/bin/env node
/**
 * Read-only health check for the identity staging soak window and related CI noise.
 * Exit 0 when the soak chain looks healthy; exit 1 when intervention is required.
 */
import { spawnSync } from "node:child_process";
import {
  SOAK_MAX_GAP_MS,
  SOAK_TARGET_SAMPLES,
  checkSequentialGaps,
  checkStartGap,
  filterWithinSoakWindow,
  isSoakWindowComplete,
  resolveSoakWindow,
  soakWindowEndMs,
} from "./identity-soak-window.mjs";
import { listGithubSoakArtifacts } from "./list-github-soak-artifacts.mjs";

const repository = process.env.GITHUB_REPOSITORY ?? "LAX-UK/monorepo";
const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
const minimumSamplesBeforeGapCheck = Number(process.env.SOAK_WATCH_MIN_SAMPLES ?? "2");
const targetSamples = Number(process.env.SOAK_TARGET_SAMPLES ?? String(SOAK_TARGET_SAMPLES));
const maxGapMs = SOAK_MAX_GAP_MS;
const token = process.env.GH_TOKEN;

if (!token) {
  console.error("GH_TOKEN is required");
  process.exit(1);
}

async function loadLiveIdentitySha() {
  const response = await fetch(`${authBase}/health/ready`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`health/ready failed (${response.status})`);
  }
  const body = await response.json();
  const release = String(body.release ?? body.version ?? "").trim();
  if (!/^[0-9a-f]{40}$/.test(release)) {
    throw new Error(`Invalid Identity release SHA: ${release || "(missing)"}`);
  }
  return release;
}

function ghJson(args) {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout);
}

const identitySha = await loadLiveIdentitySha();
const artifacts = await listGithubSoakArtifacts({ token, repository });
const window = resolveSoakWindow({ liveSha: identitySha, artifacts });

if (!window) {
  console.log("Identity staging pipeline watch");
  console.log(`  repository: ${repository}`);
  console.log(`  identity_sha: ${identitySha}`);
  console.log("  soak window: not started (waiting for first sample on live release)");
  process.exit(0);
}

const { startedMs } = window;
const soakStartedAt = new Date(startedMs).toISOString();
const nowMs = Date.now();
const windowEndMs = soakWindowEndMs(startedMs);
const windowComplete = isSoakWindowComplete(nowMs, startedMs);

const soakRuns = ghJson([
  "run",
  "list",
  "--repo",
  repository,
  "--workflow",
  "identity-staging-soak.yml",
  "--limit",
  "120",
  "--json",
  "databaseId,status,conclusion,createdAt,headBranch,event",
]);

const branchActive = soakRuns.filter(
  (run) =>
    run.headBranch !== "main" &&
    (run.status === "in_progress" || run.status === "queued" || run.status === "pending"),
);

const mainRunsInWindow = filterWithinSoakWindow(
  soakRuns.filter((run) => run.headBranch === "main"),
  (run) => Date.parse(run.createdAt),
  startedMs,
);

const failures = mainRunsInWindow.filter((run) => run.conclusion === "failure");
const successes = mainRunsInWindow.filter((run) => run.conclusion === "success");
const inProgressMain = mainRunsInWindow.filter(
  (run) => run.status === "in_progress" || run.status === "queued" || run.status === "pending",
);

const elapsedHours = ((nowMs - startedMs) / (60 * 60 * 1000)).toFixed(2);
const evaluateAfter = new Date(windowEndMs).toISOString();

console.log("Identity staging pipeline watch");
console.log(`  repository: ${repository}`);
console.log(`  identity_sha: ${identitySha}`);
console.log(`  soak_started_at: ${soakStartedAt}`);
console.log(`  elapsed_hours: ${elapsedHours}`);
console.log(`  evaluate_after_utc: ${evaluateAfter}`);
console.log(`  window_complete: ${windowComplete}`);
console.log(
  `  main_soaks_in_window: success=${successes.length} failure=${failures.length} active=${inProgressMain.length} target=${targetSamples}`,
);

if (branchActive.length > 0) {
  console.error(
    `Non-main soak runs are active and may block concurrency: ${branchActive
      .map((run) => `${run.databaseId} (${run.headBranch})`)
      .join(", ")}`,
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(
    `Failed main soak runs in window: ${failures
      .map((run) => `${run.databaseId} @ ${run.createdAt}`)
      .join(", ")}`,
  );
  process.exit(1);
}

const successTimes = successes
  .map((run) => Date.parse(run.createdAt))
  .sort((left, right) => left - right);

if (successTimes.length > 0) {
  const startGap = checkStartGap(successTimes[0], startedMs, maxGapMs);
  if (!startGap.ok) {
    console.error(
      `First soak sample was ${Math.round(startGap.gapMs / 60000)} minutes after window start (max 25).`,
    );
    process.exit(1);
  }
}

if (successTimes.length >= minimumSamplesBeforeGapCheck) {
  const gaps = checkSequentialGaps(successTimes, maxGapMs);
  if (!gaps.ok) {
    console.error(
      `Soak dispatch gap ${Math.round(gaps.gapMs / 60000)} minutes exceeds 25 between sample ${gaps.betweenIndex} and ${gaps.betweenIndex + 1}`,
    );
    process.exit(1);
  }
}

if (windowComplete) {
  if (successes.length < targetSamples) {
    console.error(
      `Soak window complete but only ${successes.length} in-window samples (need ${targetSamples}). Dispatch identity-staging-soak mode=reset after fixing staging.`,
    );
    process.exit(1);
  }
  console.log("Soak chain health: OK (24h window complete)");
  console.log(
    "Dispatch identity-staging-soak.yml mode=evaluate on main when ready to finalize evidence.",
  );
  process.exit(0);
}

if (successes.length === 0 && inProgressMain.length === 0) {
  console.error("No successful main soak sample in the current window and nothing in progress.");
  process.exit(1);
}

const latestSuccess = successes[0];
if (latestSuccess) {
  const latestAgeMs = nowMs - Date.parse(latestSuccess.createdAt);
  if (latestAgeMs > maxGapMs && inProgressMain.length === 0) {
    console.error(
      `Last successful soak was ${Math.round(latestAgeMs / 60000)} minutes ago with no run in progress.`,
    );
    process.exit(1);
  }
}

console.log("Soak chain health: OK");
console.log("Continue waiting for the 24h window and self-dispatch chain.");
process.exit(0);
