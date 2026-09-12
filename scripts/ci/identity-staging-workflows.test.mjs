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

test("Identity staging qualification is immutable and preparation is fail-closed", () => {
  const workflow = read(".github/workflows/identity-staging-deploy.yml");

  assert.match(workflow, /identity-staging-/);
  assert.match(workflow, /client_payload\.repository == 'LAX-UK\/lax-identity'/);
  assert.match(workflow, /Read immutable Identity registry metadata/);
  assert.match(workflow, /REGISTRY: registry\.digitalocean\.com\/\$\{\{ vars\.DOCR_REGISTRY \}\}/);
  assert.match(workflow, /\.event == "workflow_run"/);
  assert.match(workflow, /compare\/\$IDENTITY_SHA\.\.\.main/);
  assert.match(workflow, /STAGE_ONLY != 'true'/);
  assert.match(workflow, /Record stage-only qualification without mutating traffic or database/);
  assert.match(workflow, /Record prepared immutable candidate for Terraform cutover/);
  assert.doesNotMatch(workflow, /imagetools create/);
  assert.doesNotMatch(workflow, /create-deployment/);
  assert.doesNotMatch(workflow, /delete-tag/);
  assert.doesNotMatch(workflow, /--force-rebuild/);
  assert.match(workflow, /IDENTITY_STANDALONE_CUTOVER_COMPLETE/);
  assertOrdered(workflow, [
    "Verify migration source and journal lineage",
    "Verify standalone publish, vulnerability, SBOM, and Sentry evidence",
    "Apply pinned migrations, grants, and OIDC registry",
    "Capture encrypted pre-deploy JWKS snapshot",
    "Record prepared immutable candidate for Terraform cutover",
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
    assert.match(workflow, /dependencies\.shopIdentity\.release/);
    assert.match(workflow, /TF_VAR_identity_image_tag/);
    assert.match(workflow, /TF_VAR_shop_identity_image_tag/);
    assert.match(workflow, /TF_VAR_shop_image_tag/);
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
  assert.match(imageContract, /waitForTagDigest/);
  assert.match(imageContract, /VERIFY_ROLLING_TAGS === "true"/);
  assert.match(imageContract, /RELEASE_MANIFEST/);
  assert.match(
    read(".github/actions/terraform-apply/action.yml"),
    /Back up Terraform state before apply/,
  );
  assert.match(
    read(".github/actions/terraform-apply/action.yml"),
    /Retain redacted Terraform plan/,
  );
  const applyAction = read(".github/actions/terraform-apply/action.yml");
  assertOrdered(applyAction, [
    "Capture post-apply state addresses",
    "Back up Terraform state after apply attempt",
    "Fail when Terraform apply failed",
  ]);
  const reusableApply = read(".github/workflows/terraform-apply-test.yml");
  assert.match(reusableApply, /parent_holds_deploy_lock/);
  assert.match(
    reusableApply,
    /TF_VAR_enable_auth_ssf_delivery: \$\{\{ inputs\.enable_auth_ssf_delivery && 'true' \|\| 'false' \}\}/,
  );
  assert.doesNotMatch(
    reusableApply,
    /TF_VAR_enable_auth_ssf_delivery:[^\n]*ENABLE_AUTH_SSF_DELIVERY_TEST/,
  );
  const planAction = read(".github/actions/terraform-plan/action.yml");
  assert.match(planAction, /retention-days: 30/);
  assert.doesNotMatch(planAction, /path: \|[\s\S]*\.tfplan/);
  assert.match(read(".github/workflows/terraform-plan.yml"), /verify-auth-terraform-env\.mjs/);
  assert.match(read(".github/workflows/terraform-apply-test.yml"), /TF_VAR_identity_image_tag/);
});

test("auth at-rest maintenance workflow is manually approved and phased", () => {
  const workflow = read(".github/workflows/auth-at-rest-maintenance-test.yml");
  assert.match(workflow, /confirm_backup/);
  assert.match(workflow, /Build compiled maintenance command/);
  assert.match(workflow, /Inventory auth at-rest state/);
  assert.match(workflow, /Apply auth at-rest backfill/);
  assert.match(workflow, /Verify auth at-rest state and key/);
  assert.match(workflow, /packages\/db\/dist\/scripts\/backfill-auth-at-rest\.js/);
  assert.match(workflow, /jwks-snapshot\.ts test/);
});

test("build images emits a release manifest artifact", () => {
  const workflow = read(".github/workflows/build-images.yml");
  const writer = read("scripts/ci/write-release-manifest.mjs");
  assert.match(workflow, /write-release-manifest\.mjs/);
  assert.match(workflow, /release-manifest-/);
  assert.match(workflow, /!\s*contains\(fromJSON\('\["shop-identity","shop"\]'\)/);
  for (const field of [
    "repository",
    "component",
    "commitSha",
    "digest",
    "sentryRelease",
    "buildRun",
  ]) {
    assert.match(writer, new RegExp(`\\b${field}(?:\\s*:|,)`));
  }
});

test("App Platform deploy action exposes exact deployment evidence and release checks", () => {
  const action = read(".github/actions/app-platform-deploy/action.yml");
  const testDeploy = read(".github/workflows/app-deploy-test.yml");
  assert.match(action, /deployment_id:/);
  assert.match(action, /value: \$\{\{ steps\.create\.outputs\.deployment_id \}\}/);
  assert.match(action, /EXPECTED_RELEASES/);
  assert.match(action, /--deployment "\$DEPLOYMENT_ID"/);
  assert.match(action, /timed out in phase/);
  assert.match(testDeploy, /actions\/app-platform-deploy/);
  assert.match(testDeploy, /Detect changes requiring immutable staging cutover/);
  assert.match(testDeploy, /apps\/shop apps\/shop-identity/);
  assert.match(testDeploy, /needs\.classify\.outputs\.immutable_boundary_changed != 'true'/);
  assert.match(read(".github/workflows/app-deploy-prod.yml"), /actions\/app-platform-deploy/);
});

test("staging rollback restores a reviewed immutable manifest through Terraform", () => {
  const workflow = read(".github/workflows/staging-recovery-test.yml");
  assert.match(workflow, /group: app-deploy-test/);
  assert.match(workflow, /rollback_manifest/);
  assert.match(workflow, /Validate recovery and rollback inputs/);
  assert.match(workflow, /parent_holds_deploy_lock: true/);
  assert.match(workflow, /fromJSON\(inputs\.rollback_manifest\)\.identity\.sha/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/terraform-apply-test\.yml/);
  assertOrdered(workflow, [
    "acceptance_enabled:",
    "  rollback_rehearsal:\n    if:",
    "  restore_candidate:\n    if:",
    "  acceptance_after_rehearsal:\n    if:",
    "  record_accepted_release:\n    needs:",
  ]);
  assert.doesNotMatch(workflow, /imagetools create/);
  assert.doesNotMatch(workflow, /delete-tag/);
  assert.match(workflow, /ssf_mode: ssf_disabled/);
  assert.match(workflow, /ssf_mode: ssf_enabled/);
});

test("live acceptance uses fixed Shop origin, credential preflight, and phased SSF modes", () => {
  const acceptance = read(".github/workflows/identity-staging-acceptance.yml");
  const browserGates = read(".github/workflows/e2e-pr.yml");
  const machineProbe = read("scripts/ci/verify-identity-machine-live.mjs");
  const bidProbe = read("scripts/ci/verify-bid-web-bff-roundtrip.mjs");
  const shopProbe = read("scripts/ci/verify-shop-oidc-roundtrip.mjs");
  const ssfProbe = read("scripts/ci/verify-identity-ssf-live.mjs");

  assert.match(acceptance, /Require acceptance credentials before infrastructure access/);
  assert.match(acceptance, /IDENTITY_ACCEPTANCE_EMAIL/);
  assert.match(acceptance, /IDENTITY_ACCEPTANCE_PASSWORD/);
  assert.match(acceptance, /DIGITALOCEAN_TOKEN: \$\{\{ secrets\.DIGITALOCEAN_TOKEN \}\}/);
  assert.match(acceptance, /database_ca_certificate/);
  assert.match(acceptance, /NODE_EXTRA_CA_CERTS/);
  assert.match(browserGates, /\.github\/workflows\/identity-staging-acceptance\.yml/);
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
  assert.doesNotMatch(acceptance, /digitalocean\/action-doctl/);
});

test("Shop images embed the release provenance required by image contracts", () => {
  for (const dockerfile of ["apps/shop-identity/Dockerfile", "apps/shop/Dockerfile"]) {
    const contents = read(dockerfile);
    assert.match(contents, /ARG IMAGE_SHA=unknown/);
    assert.match(contents, /ENV SENTRY_RELEASE=\$\{IMAGE_SHA\}/);
  }

  const shopIdentity = read("apps/shop-identity/src/index.ts");
  assert.match(shopIdentity, /buildPgConnectionConfig/);
  assert.match(shopIdentity, /new pg\.Pool\(buildPgConnectionConfig\(databaseUrl\)\)/);
});

test("fallback guard covers extraction manifests, lockfiles, and image workflows", () => {
  const guard = read(".github/workflows/identity-fallback-guard.yml");

  assert.match(guard, /pnpm-lock\.yaml/);
  assert.match(guard, /prepare-identity-lockfile\.mjs/);
  assert.match(guard, /identity-staging-deploy\.yml/);
  assert.match(guard, /build-images\.yml/);
});
