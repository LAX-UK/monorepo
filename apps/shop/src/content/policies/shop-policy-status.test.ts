import { describe, expect, it } from "vitest";
import {
  SHOP_POLICY_RELEASES,
  type ShopPolicyRelease,
  type ShopPolicySlug,
  assertShopPoliciesPublishable,
  draftShopPolicySlugs,
  isProductionDeployEnv,
} from "./shop-policy-status";

const approved: ShopPolicyRelease = {
  status: "approved",
  version: "1.0",
  lastUpdated: "2026-11-01",
};
const allApproved: Record<ShopPolicySlug, ShopPolicyRelease> = {
  terms: approved,
  delivery: approved,
  returns: approved,
  help: approved,
};

describe("Shop policy release guard", () => {
  it("recognises only the prod deployment as production", () => {
    expect(isProductionDeployEnv("prod")).toBe(true);
    expect(isProductionDeployEnv(" Production ")).toBe(true);
    for (const value of ["test", "dev", "", undefined]) {
      expect(isProductionDeployEnv(value)).toBe(false);
    }
  });

  it("fails a production build while any page is a draft, naming the drafts", () => {
    const releases = { ...allApproved, returns: { ...approved, status: "draft" as const } };
    expect(() => assertShopPoliciesPublishable("prod", releases)).toThrow(/returns/);
    expect(draftShopPolicySlugs(releases)).toEqual(["returns"]);
  });

  it("allows test and local builds with drafts, and production once all are approved", () => {
    expect(() => assertShopPoliciesPublishable("test")).not.toThrow();
    expect(() => assertShopPoliciesPublishable(undefined)).not.toThrow();
    expect(() => assertShopPoliciesPublishable("prod", allApproved)).not.toThrow();
  });

  it("keeps versions and dates well formed", () => {
    for (const release of Object.values(SHOP_POLICY_RELEASES)) {
      expect(release.version).toMatch(/^\d+\.\d+$/);
      expect(release.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(release.lastUpdated))).toBe(false);
    }
  });
});
