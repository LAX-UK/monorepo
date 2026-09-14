#!/usr/bin/env node
/**
 * Read-only health check for the identity staging soak window and related CI noise.
 * Exit 0 when the soak chain looks healthy; exit 1 when intervention is required.
 */
import { spawnSync } from "node:child_process";

const repository = process.env.GITHUB_REPOSITORY ?? "LAX-UK/monorepo";
const soakStartedAt =
  process.env.SOAK_STARTED_AT ??
  process.env.IDENTITY_SOAK_STARTED_AT_TEST ??
  "2026-09-14T08:37:21Z";
const identitySha =
  process.env.IDENTITY_SHA ??
  process.env.IDENTITY_SOAK_SHA_TEST ??
  "ada95855ba3ac912eb68a9da976b8ab31028a9e1";
const minimumSamplesBeforeGapCheck = Number(process.env.SOAK_WATCH_MIN_SAMPLES ?? "2");
const targetSamples = Number(process.env.SOAK_TARGET_SAMPLES ?? "96");
const maxGapMs = 25 * 60 * 1000;

const startedMs = Date.parse(soakStartedAt);
if (!Number.isFinite(startedMs)) {
  console.error(`Invalid SOAK_STARTED_AT: ${soakStartedAt}`);
  process.exit(1);
}

function ghJson(args) {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout);
}

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

const windowRuns = soakRuns.filter((run) => Date.parse(run.createdAt) >= startedMs);
const mainRuns = windowRuns.filter((run) => run.headBranch === "main");
const branchActive = soakRuns.filter(
  (run) =>
    run.headBranch !== "main" &&
    (run.status === "in_progress" || run.status === "queued" || run.status === "pending"),
);
const failures = mainRuns.filter((run) => run.conclusion === "failure");
const successes = mainRuns.filter((run) => run.conclusion === "success");
const inProgressMain = mainRuns.filter(
  (run) => run.status === "in_progress" || run.status === "queued" || run.status === "pending",
);

const elapsedHours = ((Date.now() - startedMs) / (60 * 60 * 1000)).toFixed(2);
const evaluateAfter = new Date(startedMs + 24 * 60 * 60 * 1000).toISOString();

console.log("Identity staging pipeline watch");
console.log(`  repository: ${repository}`);
console.log(`  identity_sha: ${identitySha}`);
console.log(`  soak_started_at: ${soakStartedAt}`);
console.log(`  elapsed_hours: ${elapsedHours}`);
console.log(`  evaluate_after_utc: ${evaluateAfter}`);
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
    `Failed main soak runs since window start: ${failures
      .map((run) => `${run.databaseId} @ ${run.createdAt}`)
      .join(", ")}`,
  );
  process.exit(1);
}

const successTimes = successes
  .map((run) => Date.parse(run.createdAt))
  .sort((left, right) => left - right);
if (successTimes.length >= minimumSamplesBeforeGapCheck) {
  for (let index = 1; index < successTimes.length; index += 1) {
    const gap = successTimes[index] - successTimes[index - 1];
    if (gap > maxGapMs) {
      console.error(
        `Soak dispatch gap ${Math.round(gap / 60000)} minutes exceeds 25 between sample ${index} and ${index + 1}`,
      );
      process.exit(1);
    }
  }
}

if (successes.length === 0 && inProgressMain.length === 0) {
  console.error("No successful main soak sample in the current window and nothing in progress.");
  process.exit(1);
}

const latestSuccess = successes[0];
if (latestSuccess) {
  const latestAgeMs = Date.now() - Date.parse(latestSuccess.createdAt);
  if (latestAgeMs > maxGapMs && inProgressMain.length === 0) {
    console.error(
      `Last successful soak was ${Math.round(latestAgeMs / 60000)} minutes ago with no run in progress.`,
    );
    process.exit(1);
  }
}

console.log("Soak chain health: OK");
if (Date.now() >= startedMs + 24 * 60 * 60 * 1000) {
  console.log(
    "24h elapsed — dispatch identity-staging-soak.yml mode=evaluate on main when sample count is sufficient.",
  );
} else {
  console.log("Continue waiting for the 24h window and self-dispatch chain.");
}
process.exit(0);
