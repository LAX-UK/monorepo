import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const verifier = resolve(root, "scripts/ci/verify-staging-migrate-contract.mjs");

const validTestTf = `
run_command = "node packages/db/dist/migrate.js && node packages/db/dist/migrate-roles.js"
env = [
  { key = "DATABASE_URL", value = module.postgres.owner_uri, type = "SECRET", scope = "RUN_TIME" },
]
`;

const validProdTf = `
run_command = "node packages/db/dist/migrate-prod.js && node packages/db/dist/migrate-roles.js"
`;

function runVerifier(testMain, prodMain) {
  return spawnSync(process.execPath, [verifier, testMain, prodMain], { encoding: "utf8" });
}

function writeFixturePair(testBody, prodBody) {
  const dir = mkdtempSync(join(tmpdir(), "staging-migrate-contract-"));
  const testMain = join(dir, "test-main.tf");
  const prodMain = join(dir, "prod-main.tf");
  writeFileSync(testMain, testBody);
  writeFileSync(prodMain, prodBody);
  return { testMain, prodMain };
}

test("staging migrate contract verifier accepts valid test and prod migrate commands", () => {
  const { testMain, prodMain } = writeFixturePair(validTestTf, validProdTf);
  const result = runVerifier(testMain, prodMain);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /staging migrate contract: ok/);
});

test("staging migrate contract verifier rejects migrate-prod on test", () => {
  const badTestTf = `
run_command = "node packages/db/dist/migrate-prod.js && node packages/db/dist/migrate-roles.js"
env = [{ key = "DATABASE_URL", value = "x", type = "SECRET", scope = "RUN_TIME" }]
`;
  const { testMain, prodMain } = writeFixturePair(badTestTf, validProdTf);
  const result = runVerifier(testMain, prodMain);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not use migrate-prod\.js/);
});

const auctionInfraTest = resolve(root, "../auction-infra/terraform/ephemeral/test/main.tf");
const auctionInfraProd = resolve(root, "../auction-infra/terraform/ephemeral/prod/main.tf");

test(
  "staging migrate contract passes for checked-out auction-infra when present",
  { skip: !existsSync(auctionInfraTest) || !existsSync(auctionInfraProd) },
  () => {
    const result = runVerifier(auctionInfraTest, auctionInfraProd);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /staging migrate contract: ok/);
  },
);
