import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

function runVerifier(extraArgs = []) {
  return spawnSync(
    process.execPath,
    [
      resolve(root, "scripts/ci/verify-staging-migrate-contract.mjs"),
      resolve(root, "../auction-infra/terraform/ephemeral/test/main.tf"),
      resolve(root, "../auction-infra/terraform/ephemeral/prod/main.tf"),
      ...extraArgs,
    ],
    { encoding: "utf8" },
  );
}

test("staging migrate contract passes for auction-infra test and prod main.tf", () => {
  const result = runVerifier();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /staging migrate contract: ok/);
});
