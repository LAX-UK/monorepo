import { describe, expect, it, vi } from "vitest";
import { AdminSubmissionsListSummaryService } from "./admin-submissions-list-summary.service.js";

describe("AdminSubmissionsListSummaryService", () => {
  it("delegates to the summary reader with staff user id", async () => {
    const summary = {
      awaitingReview: 4,
      assignedToMe: 1,
      overSla: 2,
      rejectedToday: 0,
      qualityGaps: 3,
      reviewedToday: 5,
      queueCounts: { awaiting: 4, accepted: 10, rejected: 2 },
    };
    const reader = { getSummaryForStaff: vi.fn().mockResolvedValue(summary) };
    const svc = new AdminSubmissionsListSummaryService(reader as never);
    await expect(svc.getSummary("staff-1")).resolves.toEqual(summary);
    expect(reader.getSummaryForStaff).toHaveBeenCalledWith("staff-1");
  });
});
