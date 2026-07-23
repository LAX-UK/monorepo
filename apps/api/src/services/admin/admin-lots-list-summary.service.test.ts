import { describe, expect, it, vi } from "vitest";
import { AdminLotsListSummaryService } from "./admin-lots-list-summary.service.js";

describe("AdminLotsListSummaryService", () => {
  it("aggregates lot counts and lens badges", async () => {
    const lotRepo = {
      countMatching: vi
        .fn()
        .mockResolvedValueOnce(12) // live
        .mockResolvedValueOnce(5) // draft
        .mockResolvedValueOnce(3) // ending soon
        .mockResolvedValueOnce(2) // draft missing photos
        .mockResolvedValueOnce(8) // ended
        .mockResolvedValueOnce(100) // lens all
        .mockResolvedValueOnce(12) // lens live
        .mockResolvedValueOnce(5) // lens draft
        .mockResolvedValueOnce(3), // lens ending
      sumEndedHammer: vi.fn().mockResolvedValue({ total: "125000.00", count: 8 }),
    };
    const reviewTaskReader = {
      countPendingAdminReviewTasks: vi.fn().mockResolvedValue(1),
    };

    const svc = new AdminLotsListSummaryService(lotRepo as never, reviewTaskReader as never);
    const summary = await svc.getSummary();

    expect(summary.liveCount).toBe(12);
    expect(summary.draftCount).toBe(5);
    expect(summary.endingSoonCount).toBe(3);
    expect(summary.needsAttentionCount).toBe(3); // 2 photos + 1 withdrawal
    expect(summary.endedCount).toBe(8);
    expect(summary.publishedCount).toBe(95);
    expect(summary.totalHammerValue).toBe("125000.00");
    expect(summary.lensCounts).toEqual({
      all: 100,
      live: 12,
      draft: 5,
      ending: 3,
      attention: 3,
    });
  });
});
