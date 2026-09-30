import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("CI cancels in-progress runs only on pull requests", () => {
  const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
});

test("CI docker-images and identity jobs skip when paths unchanged", () => {
  const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /docker_paths\.outputs\.docker/);
  assert.match(workflow, /identity_paths\.outputs\.identity/);
  assert.doesNotMatch(workflow, /^\s+migration-matrix:/m);
});

test("main full-verify does not duplicate PR role-contract jobs", () => {
  const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  const start = workflow.indexOf("  full-verify:");
  const tail = workflow.slice(start);
  assert.doesNotMatch(tail, /test:auth-role-contract/);
  assert.doesNotMatch(tail, /worker-app-role/);
});
