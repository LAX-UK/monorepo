import { describe, expect, it } from "vitest";
import { SHOP_POLICY_RELEASES, isProductionDeployEnv } from "./shop-policy-status";

describe("Shop policy releases", () => {
  it("recognises only the prod deployment as production", () => {
    expect(isProductionDeployEnv("prod")).toBe(true);
    expect(isProductionDeployEnv(" Production ")).toBe(true);
    for (const value of ["test", "dev", "", undefined]) {
      expect(isProductionDeployEnv(value)).toBe(false);
    }
  });

  it("keeps versions and dates well formed", () => {
    for (const release of Object.values(SHOP_POLICY_RELEASES)) {
      expect(release.version).toMatch(/^\d+\.\d+$/);
      expect(release.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(release.lastUpdated))).toBe(false);
    }
  });
});
