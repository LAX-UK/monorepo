import type { LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { resumeOnboardingStepKey } from "./org-onboarding-step-map";

describe("resumeOnboardingStepKey", () => {
  it("returns null for terminal / non-onboarding statuses", () => {
    const terminal: LegalEntityStatus[] = ["approved", "archived", "rejected", "restricted"];
    for (const s of terminal) {
      expect(resumeOnboardingStepKey(s)).toBeNull();
    }
  });

  it("maps in-progress statuses to wizard steps", () => {
    expect(resumeOnboardingStepKey("lead")).toBe("type");
    expect(resumeOnboardingStepKey("docs_requested")).toBe("documents");
    expect(resumeOnboardingStepKey("docs_received")).toBe("documents");
    expect(resumeOnboardingStepKey("connect_pending")).toBe("connect");
    expect(resumeOnboardingStepKey("under_review")).toBe("identity");
  });
});
