import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../../..");
const readRoot = (path: string) => readFileSync(resolve(root, path), "utf8");

const WORKFLOWS = [
  ".github/workflows/terraform-apply-prod.yml",
  ".github/workflows/terraform-apply-test.yml",
  ".github/workflows/terraform-plan.yml",
  ".github/workflows/terraform-drift-check.yml",
  ".github/workflows/terraform-test-up.yml",
  ".github/workflows/terraform-test-down.yml",
] as const;

describe("identity onboarding deployment contract", () => {
  it("documents and forwards independent identity and full-flow rollout switches", () => {
    for (const key of ["KYC_ONBOARDING_ENABLED", "FULL_BUYER_ONBOARDING_ENABLED"]) {
      expect(readRoot(".env.example")).toContain(`${key}=false`);
      expect(readRoot(".env.production.example")).toContain(`${key}=false`);
      expect(readRoot("turbo.json")).toContain(`"${key}"`);
      expect(readRoot("docker-compose.prod.yml")).toContain(`${key}: \${${key}:-false}`);
    }
  });

  it("documents and forwards the strict bid eligibility switch", () => {
    expect(readRoot(".env.example")).toContain("STRICT_BID_ELIGIBILITY_ENABLED=true");
    expect(readRoot(".env.production.example")).toContain("STRICT_BID_ELIGIBILITY_ENABLED=false");
    expect(readRoot("turbo.json")).toContain('"STRICT_BID_ELIGIBILITY_ENABLED"');
    expect(readRoot("turbo.json")).toContain('"APP_ENV"');
    expect(readRoot("docker-compose.prod.yml")).toContain(
      "STRICT_BID_ELIGIBILITY_ENABLED: ${STRICT_BID_ELIGIBILITY_ENABLED:-false}",
    );
    expect(readRoot("docker-compose.prod.yml")).toContain("APP_ENV: production");
  });

  it("passes all three rollout flags through every Terraform workflow", () => {
    for (const workflow of WORKFLOWS) {
      const contents = readRoot(workflow);
      expect(contents).toContain("TF_VAR_strict_bid_eligibility_enabled:");
      expect(contents).toContain("TF_VAR_kyc_onboarding_enabled:");
      expect(contents).toContain("TF_VAR_full_buyer_onboarding_enabled:");
      expect(contents).toContain("vars.KYC_ONBOARDING_ENABLED || 'false'");
      expect(contents).toContain("vars.FULL_BUYER_ONBOARDING_ENABLED || 'false'");
    }

    expect(readRoot(".github/workflows/terraform-apply-prod.yml")).toContain(
      "vars.STRICT_BID_ELIGIBILITY_ENABLED || 'false'",
    );
    expect(readRoot(".github/workflows/terraform-apply-test.yml")).toContain(
      "vars.STRICT_BID_ELIGIBILITY_ENABLED || 'true'",
    );
  });
});
