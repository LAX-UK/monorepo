#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const defaultTestMain = resolve(repoRoot, "../auction-infra/terraform/ephemeral/test/main.tf");
const defaultProdMain = resolve(repoRoot, "../auction-infra/terraform/ephemeral/prod/main.tf");

const targets = [
  {
    label: "test",
    terraformPath: resolve(process.argv[2] ?? defaultTestMain),
    tier: "test",
    authEndComponent: "shop-identity",
  },
  {
    label: "prod",
    terraformPath: resolve(process.argv[3] ?? defaultProdMain),
    tier: "prod",
    authEndComponent: "ws",
  },
].filter((target) => existsSync(target.terraformPath));

if (targets.length === 0) {
  throw new Error("No Terraform main.tf paths found for auth env contract verification");
}

const envSource = readFileSync(resolve(repoRoot, "apps/auth/src/env.ts"), "utf8");

const testRequiredAuthKeys = [
  "NODE_ENV",
  "APP_ENV",
  "DATABASE_URL",
  "DATABASE_URL_AUTH",
  "REDIS_URL",
  "BETTER_AUTH_SECRET",
  "API_INTERNAL_BASE_URL",
  "OIDC_ISSUER_URL",
  "WEB_ORIGIN",
  "SHOP_ORIGIN",
  "WEB_ORIGINS",
  "AUTH_DEK_KEY",
  "IDENTITY_MACHINE_CLIENT_ID",
  "IDENTITY_MACHINE_CLIENT_SECRET",
  "METRICS_TOKEN",
  "SSF_DELIVERY_ENABLED",
];

const prodRequiredAuthKeys = [
  "NODE_ENV",
  "APP_ENV",
  "DATABASE_URL",
  "DATABASE_URL_AUTH",
  "REDIS_URL",
  "BETTER_AUTH_SECRET",
  "OIDC_ISSUER_URL",
  "WEB_ORIGIN",
  "SHOP_ORIGIN",
  "WEB_ORIGINS",
  "AUTH_DEK_KEY",
];

const inheritedCommonKeys = new Set(["NODE_ENV", "APP_ENV", "BETTER_AUTH_SECRET"]);

function locateComponent(terraform, name) {
  const match = terraform.match(new RegExp(`name\\s*=\\s*"${name}"`));
  return match?.index ?? -1;
}

function collectViolations(target) {
  const { terraformPath, tier, authEndComponent, label } = target;
  const terraform = readFileSync(terraformPath, "utf8");
  const outputs = readFileSync(resolve(dirname(terraformPath), "outputs.tf"), "utf8");
  const requiredAuthKeys = tier === "prod" ? prodRequiredAuthKeys : testRequiredAuthKeys;
  const violations = [];

  const authStart = locateComponent(terraform, "auth");
  const authEnd = locateComponent(terraform, authEndComponent);
  const migrateStart = locateComponent(terraform, "migrate");
  if (authStart < 0 || authEnd < 0 || migrateStart < 0) {
    violations.push(
      `[${label}] Could not locate auth, ${authEndComponent}, and migrate component boundaries`,
    );
    return violations;
  }

  const auth = terraform.slice(authStart, authEnd);
  const migrate = terraform.slice(migrateStart);
  const commonEnvStart = terraform.indexOf("common_secret_env = [");
  const commonEnvEnd = terraform.indexOf("\n  ]", commonEnvStart);
  if (commonEnvStart < 0 || commonEnvEnd < 0 || !auth.includes("local.common_secret_env")) {
    violations.push(`[${label}] Could not prove that auth consumes common_secret_env`);
    return violations;
  }
  const commonAuthEnv = terraform.slice(commonEnvStart, commonEnvEnd);

  for (const key of requiredAuthKeys) {
    if (!envSource.includes(`${key}:`)) {
      violations.push(`[${label}] ${key} is not declared by apps/auth/src/env.ts`);
    }
    const source = inheritedCommonKeys.has(key) ? commonAuthEnv : auth;
    if (!source.includes(`key = "${key}"`)) {
      violations.push(`[${label}] Terraform auth environment omits ${key}`);
    }
  }

  if (tier === "test") {
    if (!/image_repository\s*=\s*"lax-test-identity"/.test(auth)) {
      violations.push("[test] auth does not use lax-test-identity");
    }
    if (!/deploy_source\s*=\s*"image"/.test(auth)) {
      violations.push("[test] auth does not override deploy_source to image");
    }
    if (!/health_check_path\s*=\s*"\/health\/ready"/.test(auth)) {
      violations.push("[test] auth traffic admission does not use /health/ready");
    }
    if (auth.includes('key = "SENTRY_RELEASE"')) {
      violations.push("[test] auth overrides the image-embedded SENTRY_RELEASE");
    }
    if (
      !/auth_sentry_env\s*=\s*\[[\s\S]*?contains\(\["SENTRY_RELEASE", "SENTRY_AUTH_TOKEN", "SENTRY_ORG"\]/.test(
        terraform,
      )
    ) {
      violations.push(
        "[test] auth runtime does not filter all build-only Sentry environment variables",
      );
    }
    if (!/output\s+"auth_metrics_token"\s*\{/.test(outputs)) {
      violations.push("[test] Terraform does not expose the test-only auth metrics token to acceptance");
    }
    for (const command of ["migrate-prod.js", "migrate-roles.js", "configure-oidc-clients.js"]) {
      if (!migrate.includes(command)) {
        violations.push(`[test] migrate PRE_DEPLOY omits ${command}`);
      }
    }

    const shopStart = locateComponent(terraform, "shop");
    const wsStart = locateComponent(terraform, "ws");
    if (shopStart < 0 || wsStart < 0) {
      violations.push("[test] Could not locate shop and ws component boundaries");
    } else {
      const shop = terraform.slice(shopStart, wsStart);
      for (const key of ["SHOP_IDENTITY_BASE_URL", "IDENTITY_PUBLIC_BASE_URL"]) {
        if (!shop.includes(`key = "${key}"`)) {
          violations.push(`[test] Terraform shop environment omits ${key}`);
        }
      }
      if (shop.includes("shop-identity.PRIVATE_URL")) {
        violations.push(
          "[test] shop SHOP_IDENTITY_BASE_URL must use the public shop origin, not PRIVATE_URL",
        );
      }
    }
  }

  if (tier === "prod" && !/local\.domain\.shop/.test(auth)) {
    violations.push("[prod] SHOP_ORIGIN must bind to local.domain.shop");
  }

  return violations;
}

const violations = targets.flatMap(collectViolations);

if (violations.length > 0) {
  console.error("Auth Terraform contract violations:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `auth Terraform env contract: ok (${targets.map((t) => t.label).join(", ")}; SHOP_ORIGIN on auth)`,
);
