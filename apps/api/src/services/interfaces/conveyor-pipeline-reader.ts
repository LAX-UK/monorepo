import type { ItemSubmissionStatus, LotStatus } from "@auction/types";

export type ConveyorPipelineRow = {
  submissionId: string;
  title: string;
  submissionStatus: ItemSubmissionStatus;
  convertedLotId: string | null;
  lotId: string | null;
  lotStatus: LotStatus | null;
  lotTitle: string | null;
  artistReviewRequired: boolean | null;
  archivedSeller: boolean | null;
  assignedToUserId: string | null;
  updatedAt: Date;
};

/** Read joined submission + converted lot rows for admin conveyor / ops pipeline. */
export interface IConveyorPipelineReader {
  listRecent(limit?: number): Promise<ConveyorPipelineRow[]>;
}
