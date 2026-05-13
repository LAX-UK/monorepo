import type { Database } from "@auction/db";
import { itemSubmission, lot } from "@auction/db/schema";
import type { ItemSubmissionStatus, LotStatus } from "@auction/types";
import { desc, eq } from "drizzle-orm";
import type {
  ConveyorPipelineRow,
  IConveyorPipelineReader,
} from "../services/interfaces/conveyor-pipeline-reader.js";

/** Recent submissions with optional converted lot row for ops pipeline / conveyor UI. */
export class DrizzleConveyorPipelineReader implements IConveyorPipelineReader {
  constructor(private readonly db: Database) {}

  async listRecent(limit = 200): Promise<ConveyorPipelineRow[]> {
    const rows = await this.db
      .select({
        submissionId: itemSubmission.id,
        title: itemSubmission.title,
        submissionStatus: itemSubmission.status,
        convertedLotId: itemSubmission.convertedLotId,
        lotId: lot.id,
        lotStatus: lot.status,
        lotTitle: lot.title,
        artistReviewRequired: lot.artistReviewRequired,
        archivedSeller: lot.archivedSeller,
        assignedToUserId: itemSubmission.assignedToUserId,
        updatedAt: itemSubmission.updatedAt,
      })
      .from(itemSubmission)
      .leftJoin(lot, eq(itemSubmission.convertedLotId, lot.id))
      .orderBy(desc(itemSubmission.updatedAt))
      .limit(limit);

    return rows.map((r) => ({
      submissionId: r.submissionId,
      title: r.title,
      submissionStatus: r.submissionStatus as ItemSubmissionStatus,
      convertedLotId: r.convertedLotId,
      lotId: r.lotId,
      lotStatus: r.lotStatus as LotStatus | null,
      lotTitle: r.lotTitle,
      artistReviewRequired: r.artistReviewRequired,
      archivedSeller: r.archivedSeller,
      assignedToUserId: r.assignedToUserId,
      updatedAt: r.updatedAt,
    }));
  }
}
