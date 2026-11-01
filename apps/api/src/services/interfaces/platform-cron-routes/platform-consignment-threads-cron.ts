/** What one sweep did: replies the account was told of late, and covers sent back. */
export type ConsignmentThreadSweepCronResult = {
  readonly repliesNotified: number;
  readonly coversEnded: number;
};

export interface IPlatformConsignmentThreadsCronApplicationService {
  /**
   * Tells the account about staff replies whose delivery job was lost, and returns covers that
   * have passed their end date to the specialist. Safe to repeat and to run twice at once.
   */
  sweepConsignmentThreads(): Promise<ConsignmentThreadSweepCronResult>;
}
