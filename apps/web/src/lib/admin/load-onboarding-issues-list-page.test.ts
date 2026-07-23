import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getPageMock = vi.fn();
const findInLensMock = vi.fn();

vi.mock("@/lib/data/http/admin-onboarding-issues.reader", () => ({
  getAdminOnboardingIssuesPage: (...args: unknown[]) => getPageMock(...args),
  findAdminOnboardingIssueInLens: (...args: unknown[]) => findInLensMock(...args),
}));

import { loadAdminOnboardingIssuesListPage } from "./load-onboarding-issues-list-page";

describe("loadAdminOnboardingIssuesListPage", () => {
  beforeEach(() => {
    getPageMock.mockReset();
    findInLensMock.mockReset();
  });

  it("uses row from current page when item is present", async () => {
    getPageMock.mockResolvedValueOnce({
      tab: "entities",
      rows: [{ id: "le-1", displayName: "Gallery", status: "under_review" }],
      total: 1,
      offset: 0,
      limit: 50,
      summary: {
        queueTotal: 1,
        entities: 1,
        artists: 0,
        kyc: 0,
        organizations: 0,
        documents: 0,
      },
      lensSummary: {
        tab: "entities",
        summary: { total: 1, docsReceived: 0, underReview: 1 },
      },
      hasNextPage: false,
    });

    const loaded = await loadAdminOnboardingIssuesListPage({ tab: "entities", item: "le-1" });

    expect(loaded.selected?.id).toBe("le-1");
    expect(findInLensMock).not.toHaveBeenCalled();
  });

  it("fetches off-page selected item when not on current page", async () => {
    getPageMock.mockResolvedValueOnce({
      tab: "entities",
      rows: [{ id: "le-1", displayName: "Gallery", status: "under_review" }],
      total: 2,
      offset: 0,
      limit: 1,
      summary: {
        queueTotal: 2,
        entities: 2,
        artists: 0,
        kyc: 0,
        organizations: 0,
        documents: 0,
      },
      lensSummary: {
        tab: "entities",
        summary: { total: 2, docsReceived: 0, underReview: 2 },
      },
      hasNextPage: true,
    });
    findInLensMock.mockResolvedValueOnce({
      id: "le-2",
      displayName: "Studio",
      status: "under_review",
    });

    const loaded = await loadAdminOnboardingIssuesListPage({ tab: "entities", item: "le-2" });

    expect(findInLensMock).toHaveBeenCalledWith(
      "entities",
      "le-2",
      expect.objectContaining({ knownTotal: 2 }),
    );
    expect(loaded.selected?.id).toBe("le-2");
  });
});
