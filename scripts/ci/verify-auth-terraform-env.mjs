#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const terraformPath = resolve(
  process.argv[2] ?? `${repoRoot}/../auction-infra/terraform/ephemeral/test/main.tf`,
);
const envSource = readFileSync(resolve(repoRoot, "apps/auth/src/env.ts"), "utf8");
const terraform = readFileSync(terraformPath, "utf8");

const authStart = terraform.indexOf('name              = "auth"');
const authEnd = terraform.indexOf('name              = "shop-identity"', authStart);
const migrateStart = terraform.indexOf('name            = "migrate"');
if (authStart < 0 || authEnd < 0 || migrateStart < 0) {
  throw new Error("Could not locate auth, shop-identity, and migrate component boundaries");
}

const auth = terraform.slice(authStart, authEnd);
const migrate = terraform.slice(migrateStart);
const requiredAuthKeys = [
  "NODE_ENV",
  "APP_ENV",
  "DATABASE_URL",
  "DATABASE_URL_AUTH",
  "REDIS_URL",
  "BETTER_AUTH_SECRET",
  "API_INTERNAL_BASE_URL",
  "OIDC_ISSUER_URL",
  "WEB_ORIGIN",
  "WEB_ORIGINS",
  "AUTH_DEK_KEY",
  "IDENTITY_MACHINE_CLIENT_ID",
  "IDENTITY_MACHINE_CLIENT_SECRET",
  "METRICS_TOKEN",
  "SSF_DELIVERY_ENABLED",
];

const violations = [];
for (const key of requiredAuthKeys) {
  if (!envSource.includes(`${key}:`))
    violations.push(`${key} is not declared by apps/auth/src/env.ts`);
  if (!auth.includes(`key = "${key}"`) && !terraform.includes(`key = "${key}"`)) {
    violations.push(`Terraform auth environment omits ${key}`);
  }
}
if (!/image_repository\s*=\s*"lax-test-identity"/.test(auth)) {
  violations.push("auth does not use lax-test-identity");
}
if (!/deploy_source\s*=\s*"image"/.test(auth)) {
  violations.push("auth does not override deploy_source to image");
}
if (!/health_check_path\s*=\s*"\/health\/ready"/.test(auth)) {
  violations.push("auth traffic admission does not use /health/ready");
}
if (auth.includes('key = "SENTRY_RELEASE"')) {
  violations.push("auth overrides the image-embedded SENTRY_RELEASE");
}
for (const command of ["migrate-prod.js", "migrate-roles.js", "configure-oidc-clients.js"]) {
  if (!migrate.includes(command)) violations.push(`migrate PRE_DEPLOY omits ${command}`);
}

if (violations.length > 0) {
  console.error("Auth Terraform contract violations:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log(`auth Terraform env contract: ok (${requiredAuthKeys.length} required keys)`);
