import type { AdminReviewTaskRow } from "./admin-read-models.js";

export interface IAdminReviewTaskReader {
  listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]>;
  countPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<number>;
}

export type { AdminReviewTaskRow };
