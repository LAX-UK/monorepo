import { describe, expect, it, vi } from "vitest";
import { AdminReviewTaskQueryService } from "./admin-review-task-query.service.js";

describe("AdminReviewTaskQueryService", () => {
  it("counts pending tasks for the requested kind", async () => {
    const reader = {
      countPendingAdminReviewTasks: vi.fn().mockResolvedValue(4),
      listPendingAdminReviewTasks: vi.fn(),
    };
    const svc = new AdminReviewTaskQueryService(reader);

    await expect(svc.countPendingAdminReviewTasks("lot_artist_backfill")).resolves.toBe(4);
    expect(reader.countPendingAdminReviewTasks).toHaveBeenCalledWith("lot_artist_backfill");
  });

  it("lists pending tasks for the requested kind", async () => {
    const rows = [{ id: "task-1", kind: "lot_withdrawal_request", status: "pending" }];
    const reader = {
      countPendingAdminReviewTasks: vi.fn(),
      listPendingAdminReviewTasks: vi.fn().mockResolvedValue(rows),
    };
    const svc = new AdminReviewTaskQueryService(reader);

    await expect(svc.listPendingAdminReviewTasks("lot_withdrawal_request")).resolves.toEqual(rows);
    expect(reader.listPendingAdminReviewTasks).toHaveBeenCalledWith("lot_withdrawal_request");
  });
});
