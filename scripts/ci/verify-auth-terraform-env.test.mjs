import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const verifier = resolve(root, "scripts/ci/verify-auth-terraform-env.mjs");
const auctionInfraTest = resolve(root, "../auction-infra/terraform/ephemeral/test/main.tf");

function runVerifier(terraformMain) {
  return spawnSync(process.execPath, [verifier, terraformMain], { encoding: "utf8" });
}

test(
  "auth terraform env contract passes for checked-out auction-infra when present",
  { skip: !existsSync(auctionInfraTest) },
  () => {
    const result = runVerifier(auctionInfraTest);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /auth Terraform env contract: ok/);
  },
);
