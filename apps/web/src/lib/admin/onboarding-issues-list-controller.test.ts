import { describe, expect, it } from "vitest";
import { onboardingIssuesListController } from "./onboarding-issues-list-controller";

describe("onboardingIssuesListController.parseQuery", () => {
  it("defaults tab to entities", () => {
    expect(onboardingIssuesListController.parseQuery({}).tab).toBe("entities");
  });

  it("parses valid tab from search params", () => {
    expect(onboardingIssuesListController.parseQuery({ tab: "kyc" }).tab).toBe("kyc");
  });

  it("falls back for unknown tab", () => {
    expect(onboardingIssuesListController.parseQuery({ tab: "invalid" }).tab).toBe("entities");
  });
});
