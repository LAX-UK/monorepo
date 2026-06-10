import {
  earliestIncompleteOrgOnboardingStep,
  orgOnboardingResumeHref,
  resolveBlockedOnboardingStep,
  resolveTypeStepForwardRedirect,
} from "@/lib/legal-entity/org-onboarding-resume";
import type { OrgOnboardingStepKey } from "@auction/types";
import { describe, expect, it } from "vitest";

describe("org-onboarding-resume", () => {
  it("builds resume href for earliest incomplete step", () => {
    const completed: OrgOnboardingStepKey[] = ["type", "details"];
    expect(orgOnboardingResumeHref("entity-1", completed)).toBe(
      "/onboarding/organisation/step/documents?entityId=entity-1",
    );
  });

  it("returns null earliest step when all complete", () => {
    const completed: OrgOnboardingStepKey[] = [
      "type",
      "details",
      "documents",
      "connect",
      "identity",
    ];
    expect(earliestIncompleteOrgOnboardingStep(completed)).toBeNull();
  });

  describe("resolveBlockedOnboardingStep", () => {
    it("allows the current or earlier incomplete step", () => {
      const completed: OrgOnboardingStepKey[] = ["type", "details"];
      expect(resolveBlockedOnboardingStep("details", completed)).toBeNull();
      expect(resolveBlockedOnboardingStep("type", completed)).toBeNull();
    });

    it("blocks jumping ahead to a later step", () => {
      const completed: OrgOnboardingStepKey[] = ["type"];
      expect(resolveBlockedOnboardingStep("documents", completed)).toBe("details");
      expect(resolveBlockedOnboardingStep("connect", completed)).toBe("details");
    });

    it("allows any step when onboarding is complete", () => {
      const completed: OrgOnboardingStepKey[] = [
        "type",
        "details",
        "documents",
        "connect",
        "identity",
      ];
      expect(resolveBlockedOnboardingStep("identity", completed)).toBeNull();
    });
  });

  describe("resolveTypeStepForwardRedirect", () => {
    it("returns null when type is not yet complete", () => {
      expect(resolveTypeStepForwardRedirect([])).toBeNull();
      expect(resolveTypeStepForwardRedirect(["details"])).toBeNull();
    });

    it("skips forward when type is complete and details is next", () => {
      expect(resolveTypeStepForwardRedirect(["type"])).toBe("details");
    });

    it("skips to the earliest incomplete step after type", () => {
      expect(resolveTypeStepForwardRedirect(["type", "details", "documents"])).toBe("connect");
    });

    it("returns null when type is not yet marked complete", () => {
      expect(resolveTypeStepForwardRedirect(["details"])).toBeNull();
    });

    it("returns null when every step including type is complete", () => {
      expect(
        resolveTypeStepForwardRedirect(["type", "details", "documents", "connect", "identity"]),
      ).toBeNull();
    });
  });
});
