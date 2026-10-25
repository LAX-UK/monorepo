import { describe, expect, it } from "vitest";
import {
  canShowCheckoutTerms,
  isShopProductionDeployment,
  linkableShopPolicies,
  resolveShopPolicyVisibility,
} from "./shop-policy-publication";

const draft = { status: "draft", version: "0.1", lastUpdated: "2026-10-25" } as const;
const approved = { status: "approved", version: "1.0", lastUpdated: "2026-11-01" } as const;

describe("isShopProductionDeployment", () => {
  it("treats the launch host or a prod image as production", () => {
    expect(
      isShopProductionDeployment({ storefrontHost: "shop.lax.art", deployEnv: undefined }),
    ).toBe(true);
    expect(
      isShopProductionDeployment({ storefrontHost: "SHOP.LAX.ART:443", deployEnv: "test" }),
    ).toBe(true);
    expect(
      isShopProductionDeployment({
        storefrontHost: "shop-abc.ondigitalocean.app",
        deployEnv: "prod",
      }),
    ).toBe(true);
  });

  it("treats test and local hosts as non-production", () => {
    expect(
      isShopProductionDeployment({ storefrontHost: "test-shop.lax.bid", deployEnv: "test" }),
    ).toBe(false);
    expect(isShopProductionDeployment({ storefrontHost: "localhost", deployEnv: undefined })).toBe(
      false,
    );
  });
});

describe("resolveShopPolicyVisibility", () => {
  it("previews drafts with a banner off production and hides them on production", () => {
    expect(resolveShopPolicyVisibility(draft, false)).toBe("draft-preview");
    expect(resolveShopPolicyVisibility(draft, true)).toBe("hidden");
  });

  it("publishes approved pages everywhere", () => {
    expect(resolveShopPolicyVisibility(approved, false)).toBe("published");
    expect(resolveShopPolicyVisibility(approved, true)).toBe("published");
  });
});

describe("linkableShopPolicies", () => {
  const releases = {
    terms: approved,
    delivery: draft,
    returns: draft,
    help: draft,
    privacy: draft,
    cookies: draft,
  };

  it("drops drafts on production so footer and checkout never link to a 404", () => {
    expect(linkableShopPolicies(releases, true)).toEqual(["terms"]);
    expect(canShowCheckoutTerms(linkableShopPolicies(releases, true))).toBe(false);
  });

  it("links every page off production, drafts included", () => {
    expect(linkableShopPolicies(releases, false)).toEqual([
      "terms",
      "delivery",
      "returns",
      "help",
      "privacy",
      "cookies",
    ]);
    expect(canShowCheckoutTerms(linkableShopPolicies(releases, false))).toBe(true);
  });

  it("shows the checkout terms line on production once terms and returns are approved", () => {
    const ready = { ...releases, returns: approved };
    expect(canShowCheckoutTerms(linkableShopPolicies(ready, true))).toBe(true);
  });
});
