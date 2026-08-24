import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../../../..");
const readRoot = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("marketing prompt deployment contract", () => {
  it("documents and forwards the server rollout switch", () => {
    const key = "MARKETING_PROMPTS_ENABLED";
    expect(readRoot(".env.example")).toContain(`${key}=false`);
    expect(readRoot(".env.production.example")).toContain(`${key}=false`);
    expect(readRoot("turbo.json")).toContain(`"${key}"`);
    expect(readRoot("docker-compose.prod.yml")).toContain(`${key}: \${${key}:-false}`);

    for (const environment of ["test", "prod"]) {
      expect(readRoot(`infra/terraform/ephemeral/${environment}/variables.tf`)).toContain(
        'variable "marketing_prompts_enabled"',
      );
      expect(readRoot(`infra/terraform/ephemeral/${environment}/main.tf`)).toContain(
        'key = "MARKETING_PROMPTS_ENABLED"',
      );
    }

    for (const workflow of [
      "terraform-plan.yml",
      "terraform-drift-check.yml",
      "terraform-apply-prod.yml",
      "terraform-apply-test.yml",
      "terraform-test-up.yml",
      "terraform-test-down.yml",
    ]) {
      expect(readRoot(`.github/workflows/${workflow}`)).toContain(
        "TF_VAR_marketing_prompts_enabled:",
      );
    }
  });

  it("ships both exact prompt artworks", () => {
    for (const asset of ["selling.png", "signup.png"]) {
      expect(existsSync(resolve(root, `apps/web/public/images/marketing-prompts/${asset}`))).toBe(
        true,
      );
    }
  });
});
