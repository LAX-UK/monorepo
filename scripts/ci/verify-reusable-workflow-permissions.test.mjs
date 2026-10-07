import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("staging recovery grants actions:write for terraform-apply-test", () => {
  const result = spawnSync("node", ["scripts/ci/verify-reusable-workflow-permissions.mjs"], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
