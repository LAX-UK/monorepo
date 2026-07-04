import type { IAdminReviewTaskReader } from "@auction/persistence";
import type { AdminReviewTaskRow } from "../../admin/admin-route-dtos.js";
import type { IAdminReviewTaskQueryService } from "../interfaces/admin-routes.js";

export class AdminReviewTaskQueryService implements IAdminReviewTaskQueryService {
  constructor(private readonly reader: IAdminReviewTaskReader) {}

  listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]> {
    return this.reader.listPendingAdminReviewTasks(kind);
  }

  countPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<number> {
    return this.reader.countPendingAdminReviewTasks(kind);
  }
}
