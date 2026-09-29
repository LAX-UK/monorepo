export type BackfillCrmUsersSummary = {
  success: number;
  error: number;
  linkedExisting: number;
  skipped: number;
};

export function shouldBackfillExitWithError(summary: BackfillCrmUsersSummary): boolean {
  return summary.error > 0;
}
