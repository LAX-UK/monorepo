import { describe, expect, it } from "vitest";
import { buildOnboardingIssuesListPageModel } from "./build-onboarding-issues-list-page-model";

describe("buildOnboardingIssuesListPageModel", () => {
  it("parses tab, item drawer param, and pagination", () => {
    const model = buildOnboardingIssuesListPageModel({
      tab: "kyc",
      item: "kyc-1",
      limit: "200",
      offset: "25",
    });

    expect(model.query.tab).toBe("kyc");
    expect(model.query.limit).toBe(200);
    expect(model.query.offset).toBe(25);
    expect(model.selectedItemId).toBe("kyc-1");
    expect(model.listQueryParams).toEqual({ tab: "kyc", limit: 200, offset: 25 });
  });

  it("maps orgs tab to organizations for API query params", () => {
    const model = buildOnboardingIssuesListPageModel({ tab: "orgs" });
    expect(model.query.tab).toBe("orgs");
    expect(model.listQueryParams.tab).toBe("organizations");
  });

  it("buildTabHref clears item and offset", () => {
    const model = buildOnboardingIssuesListPageModel({
      tab: "entities",
      item: "le-1",
      offset: "50",
    });
    const href = model.buildTabHref("artists");
    expect(href).toContain("tab=artists");
    expect(href).not.toContain("item=");
    expect(href).not.toContain("offset=");
  });

  it("buildPaginationHref preserves drawer selection", () => {
    const model = buildOnboardingIssuesListPageModel({ item: "le-1", offset: "0" });
    expect(model.buildPaginationHref({ offset: 50 })).toContain("item=le-1");
    expect(model.buildPaginationHref({ offset: 50 })).toContain("offset=50");
  });
});
