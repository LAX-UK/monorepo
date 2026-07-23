import { describe, expect, it } from "vitest";
import { parseAdminOnboardingIssuesPageBody } from "./admin-onboarding-issues.shared";

describe("parseAdminOnboardingIssuesPageBody", () => {
  it("parses paginated list envelope with cross-lens summary and lensSummary", () => {
    const page = parseAdminOnboardingIssuesPageBody(
      {
        data: [{ id: "le-1", displayName: "Gallery", status: "under_review" }],
        meta: {
          tab: "entities",
          total: 4,
          limit: 50,
          offset: 0,
          summary: {
            queueTotal: 10,
            entities: 4,
            artists: 2,
            kyc: 1,
            organizations: 2,
            documents: 1,
          },
          lensSummary: {
            tab: "entities",
            summary: { total: 4, docsReceived: 1, underReview: 3 },
          },
        },
      },
      { tab: "entities", limit: 50, offset: 0 },
    );

    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(4);
    expect(page.summary.queueTotal).toBe(10);
    expect(page.lensSummary).toEqual({
      tab: "entities",
      summary: { total: 4, docsReceived: 1, underReview: 3 },
    });
    expect(page.hasNextPage).toBe(true);
  });

  it("rejects cross summary when buckets do not sum to queueTotal", () => {
    expect(() =>
      parseAdminOnboardingIssuesPageBody(
        {
          data: [],
          meta: {
            tab: "kyc",
            total: 0,
            summary: {
              queueTotal: 5,
              entities: 0,
              artists: 0,
              kyc: 0,
              organizations: 0,
              documents: 0,
            },
            lensSummary: {
              tab: "kyc",
              summary: { total: 0, created: 0, requiresInput: 0, processing: 0 },
            },
          },
        },
        { tab: "kyc", limit: 50, offset: 0 },
      ),
    ).toThrow(/buckets do not sum/);
  });
});
