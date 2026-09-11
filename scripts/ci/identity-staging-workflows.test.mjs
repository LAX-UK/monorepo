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
  assert.match(workflow, /Record previous rolling Identity tag and cutover mode/);
  assert.match(workflow, /Promote the qualified digest to the rolling test tag/);
  assert.match(workflow, /Restore previous rolling tag and redeploy on failure/);
  assert.match(workflow, /docker buildx imagetools create/);
  assert.match(workflow, /steps\.promote\.outcome != 'skipped'/);
  assert.match(workflow, /REGISTRY: registry\.digitalocean\.com\/\$\{\{ vars\.DOCR_REGISTRY \}\}/);
  assert.match(workflow, /\.event == "workflow_run"/);
  assert.match(workflow, /compare\/\$IDENTITY_SHA\.\.\.main/);
  assert.match(workflow, /DEPLOY_OUTCOME: \$\{\{ steps\.deploy\.outcome \}\}/);
  assert.match(workflow, /test "\$FIRST_CUTOVER" = "false"/);
  assert.doesNotMatch(workflow, /--force-rebuild/);
  assert.match(workflow, /IDENTITY_STANDALONE_CUTOVER_COMPLETE/);
  assert.doesNotMatch(workflow, /--deployment-id/);
  assert.match(workflow, /test "\$sha_digest" = "\$IDENTITY_DIGEST"/);
  const promoteIndex = workflow.indexOf("Promote the qualified digest to the rolling test tag");
  assert.doesNotMatch(
    workflow.slice(0, promoteIndex),
    /test "\$rolling_digest" = "\$IDENTITY_DIGEST"/,
  );
  assertOrdered(workflow, [
    "Verify migration source and journal lineage",
    "Verify standalone publish, vulnerability, SBOM, and Sentry evidence",
    "Apply pinned migrations, grants, and OIDC registry",
    "Capture encrypted pre-deploy JWKS snapshot",
    "Promote the qualified digest to the rolling test tag",
    "doctl apps create-deployment",
    "Require candidate readiness and release provenance",
  ]);
});

test("every ephemeral Terraform apply path enforces image contracts and serialized deploy lock", () => {
  for (const relativePath of [
    ".github/workflows/terraform-apply-test.yml",
    ".github/workflows/terraform-test-up.yml",
  ]) {
    const workflow = read(relativePath);
    assert.match(workflow, /app-deploy-test/);
    assert.match(workflow, /verify-staging-image-contract\.mjs/);
    assert.match(workflow, /verify-auth-terraform-env\.mjs/);
    assert.match(workflow, /verify-plan-safe/);
    assert.match(workflow, /doctl registry login --expiry-seconds 900/);
    assert.match(
      workflow,
      /DOCR_REGISTRY: registry\.digitalocean\.com\/\$\{\{ vars\.DOCR_REGISTRY \}\}/,
    );
    assert.match(workflow, /allowed-delete-addresses/);
    assert.match(workflow, /Require Shop DNS, TLS, and readiness after apply/);
  }

  const imageContract = read("scripts/ci/verify-staging-image-contract.mjs");
  for (const required of [
    "IDENTITY_SHA",
    "IDENTITY_DIGEST",
    "SHOP_IDENTITY_SHA",
    "SHOP_IDENTITY_DIGEST",
    "SHOP_SHA",
    "SHOP_DIGEST",
  ]) {
    assert.match(imageContract, new RegExp(`\\["${required}",`));
  }
  assert.match(
    read(".github/actions/terraform-apply/action.yml"),
    /Retain redacted Terraform plan/,
  );
  const planAction = read(".github/actions/terraform-plan/action.yml");
  assert.match(planAction, /retention-days: 30/);
  assert.doesNotMatch(planAction, /path: \|[\s\S]*\.tfplan/);
  assert.match(read(".github/workflows/terraform-plan.yml"), /verify-auth-terraform-env\.mjs/);
});

test("live acceptance uses fixed Shop origin, credential preflight, and phased SSF modes", () => {
  const acceptance = read(".github/workflows/identity-staging-acceptance.yml");
  const machineProbe = read("scripts/ci/verify-identity-machine-live.mjs");
  const bidProbe = read("scripts/ci/verify-bid-web-bff-roundtrip.mjs");
  const shopProbe = read("scripts/ci/verify-shop-oidc-roundtrip.mjs");
  const ssfProbe = read("scripts/ci/verify-identity-ssf-live.mjs");

  assert.match(acceptance, /Require acceptance credentials before infrastructure access/);
  assert.match(acceptance, /IDENTITY_ACCEPTANCE_EMAIL/);
  assert.match(acceptance, /IDENTITY_ACCEPTANCE_PASSWORD/);
  assert.match(acceptance, /ssf_mode:/);
  assert.match(acceptance, /ssf_disabled/);
  assert.match(acceptance, /ssf_enabled/);
  assert.match(acceptance, /SHOP_IDENTITY_BASE_URL: https:\/\/test-shop\.lax\.bid/);
  assert.doesNotMatch(acceptance, /shop_identity_base_url/);
  assert.match(acceptance, /if: inputs\.ssf_mode == 'ssf_enabled'/);
  assert.match(acceptance, /SSF durable delivery and replay contract \(Bid receiver\)/);
  assert.match(acceptance, /SSF durable delivery and replay contract \(Shop receiver\)/);
  assert.match(acceptance, /db:reconcile-identity-profiles/);
  assert.match(acceptance, /AUTH_METRICS_TOKEN/);
  assert.match(acceptance, /jwks-snapshot\.ts test --verify/);
  assert.match(machineProbe, /expiringBody\.expires_in \+ 2/);
  assert.match(bidProbe, /redirect path is not trusted/);
  assert.match(shopProbe, /redirect path is not trusted/);
  assert.match(acceptance, /SSF_FAILURE_REHEARSAL: \$\{\{ inputs\.ssf_mode == 'ssf_enabled'/);
  assert.match(ssfProbe, /status: "disabled"/);
  assert.match(ssfProbe, /status: "enabled"/);
  assert.match(ssfProbe, /pre-enable receiver verification passed/);
  assert.match(ssfProbe, /retry and dead-letter probe passed/);
  assert.match(ssfProbe, /Provisioned SSF stream/);
  assert.match(acceptance, /Require live Identity SSF delivery worker/);
});

test("Shop images embed the release provenance required by image contracts", () => {
  for (const dockerfile of ["apps/shop-identity/Dockerfile", "apps/shop/Dockerfile"]) {
    const contents = read(dockerfile);
    assert.match(contents, /ARG IMAGE_SHA=unknown/);
    assert.match(contents, /ENV SENTRY_RELEASE=\$\{IMAGE_SHA\}/);
  }
});

test("fallback guard covers extraction manifests, lockfiles, and image workflows", () => {
  const guard = read(".github/workflows/identity-fallback-guard.yml");

  assert.match(guard, /pnpm-lock\.yaml/);
  assert.match(guard, /prepare-identity-lockfile\.mjs/);
  assert.match(guard, /identity-staging-deploy\.yml/);
  assert.match(guard, /build-images\.yml/);
});
