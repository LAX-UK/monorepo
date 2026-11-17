/**
 * Keeps CI's large-heap builds inside the runner's memory.
 *
 * A job that raises Node's heap (NODE_OPTIONS --max-old-space-size) gives that heap to every turbo
 * build task it runs at once. When a PR makes all the Next apps affected, turbo's default
 * concurrency runs them together, their heaps overrun the 16 GB GitHub runner, and the OOM killer
 * takes the runner itself: the step goes silent, no log is uploaded, and the job hangs until GitHub
 * gives up on the runner. So every `turbo run build` in such a job must cap its concurrency, and
 * the cap times the heap must leave room for the runner, turbo and the tsc package builds.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";

const RUNNER_MEMORY_MB = 16 * 1024;
const RESERVED_MB = 2 * 1024;

const workflow = yaml.load(readFileSync(".github/workflows/ci.yml", "utf8"));

function heapMb(env) {
  const match = /--max-old-space-size=(\d+)/.exec(env?.NODE_OPTIONS ?? "");
  return match ? Number(match[1]) : null;
}

function concurrencyOf(run, env) {
  const match = /--concurrency[= ]"?\$?\{?([A-Z_]+|\d+)\}?"?/.exec(run);
  if (!match) return null;
  const value = /^\d+$/.test(match[1]) ? match[1] : env?.[match[1]];
  return value === undefined ? null : Number(value);
}

const heavyBuilds = [];
for (const [jobName, job] of Object.entries(workflow.jobs)) {
  for (const step of job.steps ?? []) {
    const env = { ...workflow.env, ...job.env, ...step.env };
    const heap = heapMb(env);
    if (heap && typeof step.run === "string" && /turbo run build/.test(step.run)) {
      heavyBuilds.push({ jobName, step: step.name, run: step.run, env, heap });
    }
  }
}

test("the size-measurement build job is found", () => {
  assert.ok(
    heavyBuilds.some((b) => b.jobName === "build" && b.step === "Build"),
    "ci.yml build job's Build step with a raised heap",
  );
});

test("every large-heap turbo build caps its concurrency within the runner's memory", () => {
  for (const build of heavyBuilds) {
    const where = `${build.jobName} / ${build.step}`;
    const concurrency = concurrencyOf(build.run, build.env);
    assert.ok(concurrency && concurrency >= 1, `${where}: turbo run build needs --concurrency`);
    assert.ok(
      concurrency * build.heap <= RUNNER_MEMORY_MB - RESERVED_MB,
      `${where}: ${concurrency} builds x ${build.heap} MB heap overruns the runner`,
    );
  }
});

test("the route JavaScript base and self-check builds use the same cap", () => {
  const script = readFileSync("scripts/route-js-size-build-base.sh", "utf8");
  assert.match(script, /flags\+=\(--concurrency="\$BUILD_CONCURRENCY"\)/);
  assert.ok(workflow.jobs.build.env.BUILD_CONCURRENCY, "build job sets BUILD_CONCURRENCY");
});
