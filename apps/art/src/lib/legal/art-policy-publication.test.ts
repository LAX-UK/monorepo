import { LAX_ART_POLICIES, LAX_ART_POLICY_ORDER } from "@auction/marketing-ui";
import { describe, expect, it } from "vitest";
import {
  artPolicyVisibility,
  isArtProductionDeployment,
  linkableArtPolicies,
} from "./art-policy-publication";

const approved = { status: "approved", version: "1.0", lastUpdated: "2026-08-12" } as const;
const draft = { status: "draft", version: "0.1", lastUpdated: "2026-10-25" } as const;
const releases = Object.fromEntries(
  LAX_ART_POLICY_ORDER.map((slug) => [slug, slug === "reviews" ? draft : approved]),
) as Record<(typeof LAX_ART_POLICY_ORDER)[number], typeof approved | typeof draft>;

describe("lax.art policy publication", () => {
  it("treats the launch host or a prod image as production", () => {
    expect(
      isArtProductionDeployment({ storefrontHost: "www.thelax.art", deployEnv: undefined }),
    ).toBe(true);
    expect(
      isArtProductionDeployment({ storefrontHost: "test.thelax.art", deployEnv: "prod" }),
    ).toBe(true);
    expect(
      isArtProductionDeployment({ storefrontHost: "test.thelax.art", deployEnv: "test" }),
    ).toBe(false);
  });

  it("publishes every London Art Exchange policy on production", () => {
    expect(linkableArtPolicies(true)).toEqual(LAX_ART_POLICY_ORDER);
    for (const slug of LAX_ART_POLICY_ORDER) {
      expect(LAX_ART_POLICIES[slug].release.status, slug).toBe("approved");
    }
  });

  it("keeps a future draft off production and previews it elsewhere", () => {
    expect(artPolicyVisibility("reviews", true, releases)).toBe("hidden");
    expect(artPolicyVisibility("reviews", false, releases)).toBe("draft-preview");
    expect(linkableArtPolicies(true, releases)).not.toContain("reviews");
  });
});
