import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../../../..");
const readRoot = (path: string) => readFileSync(resolve(root, path), "utf8");

const WORKFLOWS = [
  ".github/workflows/terraform-apply-prod.yml",
  ".github/workflows/terraform-apply-test.yml",
  ".github/workflows/terraform-plan.yml",
  ".github/workflows/terraform-drift-check.yml",
  ".github/workflows/terraform-test-up.yml",
  ".github/workflows/terraform-test-down.yml",
] as const;

describe("marketing prompts deployment contract", () => {
  it("documents the flag and defaults it off in production wiring", () => {
    expect(readRoot(".env.example")).toContain("MARKETING_PROMPTS_ENABLED=");
    expect(readRoot(".env.production.example")).toContain("MARKETING_PROMPTS_ENABLED=false");
    expect(readRoot("turbo.json")).toContain('"MARKETING_PROMPTS_ENABLED"');
    expect(readRoot("docker-compose.prod.yml")).toContain(
      "MARKETING_PROMPTS_ENABLED: ${MARKETING_PROMPTS_ENABLED:-false}",
    );
  });

  it("passes the flag through every Terraform workflow, defaulting off", () => {
    for (const workflow of WORKFLOWS) {
      const contents = readRoot(workflow);
      expect(contents).toContain("TF_VAR_marketing_prompts_enabled:");
      expect(contents).toContain("vars.MARKETING_PROMPTS_ENABLED || 'false'");
    }
  });
});
