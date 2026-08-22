import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../../..");
const readRoot = (path: string) => readFileSync(resolve(root, path), "utf8");
const existsAtRoot = (path: string) => existsSync(resolve(root, path));

describe("identity onboarding deployment contract", () => {
  it("documents and forwards independent identity and full-flow rollout switches", () => {
    for (const key of ["KYC_ONBOARDING_ENABLED", "FULL_BUYER_ONBOARDING_ENABLED"]) {
      expect(readRoot(".env.example")).toContain(`${key}=false`);
      expect(readRoot(".env.production.example")).toContain(`${key}=false`);
      expect(readRoot("turbo.json")).toContain(`"${key}"`);
      expect(readRoot("docker-compose.prod.yml")).toContain(`${key}: \${${key}:-false}`);
    }
  });

  it("keeps the strict bid flag aligned across API, web, Docker, and Terraform", () => {
    const compose = readRoot("docker-compose.prod.yml");
    expect(readRoot(".env.example")).toContain("STRICT_BID_ELIGIBILITY_ENABLED=true");
    expect(readRoot(".env.production.example")).toContain("STRICT_BID_ELIGIBILITY_ENABLED=false");
    expect(readRoot("turbo.json")).toContain('"STRICT_BID_ELIGIBILITY_ENABLED"');
    expect(readRoot("turbo.json")).toContain('"APP_ENV"');
    expect(
      compose.match(/STRICT_BID_ELIGIBILITY_ENABLED: \$\{STRICT_BID_ELIGIBILITY_ENABLED:-false\}/g),
    ).toHaveLength(2);
    expect(compose.match(/APP_ENV: production/g)?.length).toBeGreaterThanOrEqual(2);

    for (const environment of ["test", "prod"]) {
      const main = readRoot(`infra/terraform/ephemeral/${environment}/main.tf`);
      const variables = readRoot(`infra/terraform/ephemeral/${environment}/variables.tf`);
      expect(variables).toContain('variable "strict_bid_eligibility_enabled"');
      expect(main.match(/key = "STRICT_BID_ELIGIBILITY_ENABLED"/g)).toHaveLength(2);
    }
  });

  it("passes rollout controls through plan, apply, drift, and test lifecycle workflows", () => {
    const workflowPaths = [
      ".github/workflows/terraform-plan.yml",
      ".github/workflows/terraform-drift-check.yml",
      ".github/workflows/terraform-apply-prod.yml",
      ".github/workflows/terraform-apply-test.yml",
      ".github/workflows/terraform-test-up.yml",
      ".github/workflows/terraform-test-down.yml",
    ];
    const terraformVariables = [
      "TF_VAR_strict_bid_eligibility_enabled",
      "TF_VAR_kyc_onboarding_enabled",
      "TF_VAR_full_buyer_onboarding_enabled",
    ];

    for (const path of workflowPaths) {
      const workflow = readRoot(path);
      for (const variable of terraformVariables) {
        expect(workflow, `${path} must set ${variable}`).toContain(`${variable}:`);
      }
    }

    expect(readRoot(".github/workflows/terraform-apply-prod.yml")).toContain(
      "vars.STRICT_BID_ELIGIBILITY_ENABLED || 'false'",
    );
    expect(readRoot(".github/workflows/terraform-apply-test.yml")).toContain(
      "vars.STRICT_BID_ELIGIBILITY_ENABLED || 'true'",
    );
  });

  it("passes critical public configuration into production web image builds", () => {
    const compose = readRoot("docker-compose.prod.yml");
    const dockerfile = readRoot("apps/web/Dockerfile");
    const criticalBuildArgs = [
      "NEXT_PUBLIC_AUTH_URL",
      "NEXT_PUBLIC_WEB_ORIGIN",
      "NEXT_PUBLIC_MEDIA_BASE_URL",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "NEXT_PUBLIC_TURNSTILE_REQUIRED",
      "NEXT_PUBLIC_FORCE_ORG_MODULE",
    ];

    for (const key of criticalBuildArgs) {
      expect(compose).toContain(`${key}:`);
      expect(dockerfile).toContain(`ARG ${key}=`);
      expect(dockerfile).toContain(`ENV ${key}=$${key}`);
    }
  });

  it("ships every static identity asset referenced by onboarding pages", () => {
    for (const asset of [
      "arrow-back.svg",
      "clock.svg",
      "photo-id.svg",
      "good-lighting.svg",
      "phone.svg",
    ]) {
      expect(existsAtRoot(`apps/web/public/images/onboarding/identity/${asset}`)).toBe(true);
    }
  });
});
