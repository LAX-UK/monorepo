import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const verifier = resolve(root, "scripts/ci/verify-auth-terraform-env.mjs");
const auctionInfraTest = resolve(root, "../auction-infra/terraform/ephemeral/test/main.tf");
const auctionInfraProd = resolve(root, "../auction-infra/terraform/ephemeral/prod/main.tf");

function runVerifier(testMain, prodMain) {
  const args = [verifier];
  if (testMain) args.push(testMain);
  if (prodMain) args.push(prodMain);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

test(
  "auth terraform env contract passes for checked-out auction-infra test and prod when present",
  { skip: !existsSync(auctionInfraTest) || !existsSync(auctionInfraProd) },
  () => {
    const result = runVerifier(auctionInfraTest, auctionInfraProd);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /auth Terraform env contract: ok/);
    assert.match(result.stdout, /test, prod/);
  },
);
