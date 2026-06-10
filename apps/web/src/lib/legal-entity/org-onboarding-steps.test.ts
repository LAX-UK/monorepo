import {
  ORG_ONBOARDING_STEP_META,
  ORG_ONBOARDING_TIMELINE_STAGES,
  orgOnboardingStepKeyFromPathname,
} from "@/lib/legal-entity/org-onboarding-steps";
import { ORG_ONBOARDING_STEPS } from "@auction/types";
import { describe, expect, it } from "vitest";

describe("org-onboarding-steps", () => {
  it("matches canonical step order from @auction/types", () => {
    expect(ORG_ONBOARDING_STEP_META.map((s) => s.key)).toEqual([...ORG_ONBOARDING_STEPS]);
  });

  it("exposes timeline stages with id and label", () => {
    expect(ORG_ONBOARDING_TIMELINE_STAGES).toEqual([
      { id: "type", label: "Type" },
      { id: "details", label: "Details" },
      { id: "documents", label: "Documents" },
      { id: "connect", label: "Connect" },
      { id: "identity", label: "Identity" },
    ]);
  });

  it("parses step key from onboarding pathname", () => {
    expect(orgOnboardingStepKeyFromPathname("/onboarding/organisation/step/documents")).toBe(
      "documents",
    );
    expect(orgOnboardingStepKeyFromPathname("/onboarding/organisation")).toBeNull();
  });
});
