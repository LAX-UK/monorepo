import type { QcReadyOutcome, QcReadyToPackRequest } from "@auction/artwork-register-contracts";

/** Moves a print to "quality check passed" because Zoho, which owns the job, says it passed. */
export interface QcReadyToPack {
  markPassed(request: QcReadyToPackRequest): Promise<QcReadyOutcome>;
}
