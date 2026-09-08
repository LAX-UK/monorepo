import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function assertOrdered(source, markers) {
  let previous = -1;
  for (const marker of markers) {
    const current = source.indexOf(marker);
    assert.notEqual(current, -1, `missing ${marker}`);
    assert.ok(current > previous, `${marker} is out of order`);
    previous = current;
  }
}

test("Identity staging deployment is serialized and fail-closed before traffic changes", () => {
  const workflow = read(".github/workflows/identity-staging-deploy.yml");

  assert.match(workflow, /group: app-deploy-test/);
  assert.match(workflow, /client_payload\.repository == 'LAX-UK\/lax-identity'/);
  assert.match(workflow, /test "\$rolling_digest" = "\$IDENTITY_DIGEST"/);
  assert.match(workflow, /test "\$migrate_digest" = "\$expected_migrate_digest"/);
  assertOrdered(workflow, [
    "Verify migration source and journal lineage",
    "Apply pinned migrations, grants, and OIDC registry",
    "Capture encrypted pre-deploy JWKS snapshot",
    "doctl apps create-deployment",
    "Require candidate readiness and release provenance",
  ]);
});

test("every ephemeral Terraform apply path enforces the Identity contract and image precondition", () => {
  for (const relativePath of [
    ".github/workflows/terraform-apply-test.yml",
    ".github/workflows/terraform-test-up.yml",
  ]) {
    const workflow = read(relativePath);
    assert.match(workflow, /verify-auth-terraform-env\.mjs/);
    assert.match(workflow, /list-tags lax-test-identity/);
    assertOrdered(workflow, [
      "verify-auth-terraform-env.mjs",
      "list-tags lax-test-identity",
      "terraform-apply",
    ]);
  }

  assert.match(read(".github/workflows/terraform-plan.yml"), /verify-auth-terraform-env\.mjs/);
});

test("live acceptance includes expiry, reconciliation, metrics, and bearer-boundary probes", () => {
  const acceptance = read(".github/workflows/identity-staging-acceptance.yml");
  const machineProbe = read("scripts/ci/verify-identity-machine-live.mjs");
  const bidProbe = read("scripts/ci/verify-bid-web-bff-roundtrip.mjs");

  assert.match(acceptance, /db:reconcile-identity-profiles/);
  assert.match(acceptance, /AUTH_METRICS_TOKEN/);
  assert.match(acceptance, /jwks-snapshot\.ts test --verify/);
  assert.match(machineProbe, /expiringBody\.expires_in \+ 2/);
  assert.match(bidProbe, /accepted the browser session cookie as a bearer token/);
});
