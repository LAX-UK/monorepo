import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminSubmissionOverviewPage } from "./load-submission-overview-page";

const { loadContext, loadAssignee, getSummary, getCategories, getEvents } = vi.hoisted(() => ({
  loadContext: vi.fn(),
  loadAssignee: vi.fn(),
  getSummary: vi.fn(),
  getCategories: vi.fn(),
  getEvents: vi.fn(),
}));

vi.mock("@/lib/admin/submissions/load-submission-detail-context", () => ({
  loadAdminSubmissionDetailContext: loadContext,
}));

vi.mock("@/lib/admin/submissions/load-submission-assignee", () => ({
  loadSubmissionAssigneeContext: loadAssignee,
}));

vi.mock("@/lib/data/http/admin-submissions-summary.server", () => ({
  EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY: { avgQueueAgeDays: 0 },
  getAdminSubmissionsListSummary: getSummary,
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminCategoryList: getCategories,
  getAdminDomainEventsForAggregate: getEvents,
}));

describe("loadAdminSubmissionOverviewPage", () => {
  beforeEach(() => {
    loadContext.mockReset();
    loadAssignee.mockReset();
    getSummary.mockReset();
    getCategories.mockReset();
    getEvents.mockReset();

    loadContext.mockResolvedValue({
      submission: {
        id: "sub_1",
        categoryId: "cat_1",
        assignedToUserId: "user_2",
      },
      documentCount: 2,
      submitterDisplayName: "Seller Co",
    });
    loadAssignee.mockResolvedValue({ assigneeDisplayName: "Staff One" });
    getSummary.mockResolvedValue({ avgQueueAgeDays: 3.5 });
    getCategories.mockResolvedValue([{ id: "cat_1", name: "Paintings" }]);
    getEvents.mockResolvedValue([{ id: "evt_1" }]);
  });

  it("returns overview model with resolved categories and queue metrics", async () => {
    const result = await loadAdminSubmissionOverviewPage("sub_1", "user_1");

    expect(result).toMatchObject({
      documentCount: 2,
      submitterDisplayName: "Seller Co",
      assigneeDisplayName: "Staff One",
      avgQueueAgeDays: 3.5,
      categories: [{ id: "cat_1", name: "Paintings" }],
      activityEvents: [{ id: "evt_1" }],
    });
  });

  it("returns null when the submission does not exist", async () => {
    loadContext.mockResolvedValue(null);

    await expect(loadAdminSubmissionOverviewPage("missing", "user_1")).resolves.toBeNull();
  });
});
