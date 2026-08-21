import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../../..");
const readRoot = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("identity onboarding deployment contract", () => {
  it("documents and forwards independent identity and full-flow rollout switches", () => {
    for (const key of ["KYC_ONBOARDING_ENABLED", "FULL_BUYER_ONBOARDING_ENABLED"]) {
      expect(readRoot(".env.example")).toContain(`${key}=false`);
      expect(readRoot(".env.production.example")).toContain(`${key}=false`);
      expect(readRoot("turbo.json")).toContain(`"${key}"`);
      expect(readRoot("docker-compose.prod.yml")).toContain(`${key}: \${${key}:-false}`);
    }
  });
});
