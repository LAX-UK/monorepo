import type { AdminReviewTaskRow } from "../../admin/admin-route-dtos.js";

export interface IAdminReviewTaskReader {
  listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]>;
  countPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<number>;
}
