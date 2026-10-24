import { describe, expect, it } from "vitest";
import { buildOnboardingIssuesListPageModel } from "./build-onboarding-issues-list-page-model";

describe("buildOnboardingIssuesListPageModel", () => {
  it("parses the queue, the open item, the page size and the offset", () => {
    const model = buildOnboardingIssuesListPageModel({
      tab: "kyc",
      item: "kyc-1",
      limit: "100",
      offset: "25",
    });

    expect(model.query).toEqual({ tab: "kyc", limit: 100, offset: 25 });
    expect(model.selectedItemId).toBe("kyc-1");
    expect(model.listQueryParams).toEqual({ tab: "kyc", limit: 100, offset: 25 });
  });

  it("maps the lead organisations queue to organizations for the API", () => {
    const model = buildOnboardingIssuesListPageModel({ tab: "orgs" });
    expect(model.query.tab).toBe("orgs");
    expect(model.listQueryParams.tab).toBe("organizations");
  });

  it("falls back to the entities queue and 50 rows", () => {
    const model = buildOnboardingIssuesListPageModel({ tab: "nonsense", limit: "5000" });
    expect(model.query.tab).toBe("entities");
    expect(model.query.limit).toBe(50);
  });

  it("returns to the list as it was", () => {
    const model = buildOnboardingIssuesListPageModel({ tab: "artists", offset: "50" });
    expect(model.listReturnTarget).toBe("/admin/onboarding-issues?tab=artists&offset=50");
  });
});
